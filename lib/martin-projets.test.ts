// Vérifie la présentation du dossier Martin.
// La maquette complète, si elle est fournie, est lue HORS du paquet (variable
// MARTIN_PROJETS_FIXTURE ou le fichier d'upload local). Elle n'est pas importée
// par l'application et ne doit jamais se retrouver dans public/ ni dans le build.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  compterParEtat,
  filtrerProjets,
  formaterMisAJour,
  mentionPourcentage,
  texteAvancement,
  validerDossier,
  type Projet,
} from './martin-projets.ts';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

function projet(partiel: Partial<Projet> & Pick<Projet, 'id' | 'nom' | 'categorie' | 'etat'>): Projet {
  return {
    resume: '',
    avancement: { faits: 1, total: 2, pourcentage: 50, etape: null, methode: null },
    jalons: [],
    blocages: [],
    en_attente: [],
    prochaines_etapes: [],
    references: [],
    ...partiel,
  };
}

test('pourcentage chiffré : n/N jalons · X %', () => {
  const p = projet({
    id: 'a', nom: 'A', categorie: 'Outils', etat: 'En cours',
    avancement: { faits: 4, total: 7, pourcentage: 57, etape: null, methode: null },
  });
  assert.equal(texteAvancement(p), '4/7 jalons · 57 %');
});

test('pourcentage nul : on affiche l\'étape', () => {
  const sansNombre = projet({
    id: 'b', nom: 'B', categorie: 'Chalet', etat: 'En cours',
    avancement: { faits: null, total: null, pourcentage: null, etape: 'Permis et soumissions', methode: null },
  });
  const zero = projet({
    id: 'c', nom: 'C', categorie: 'Chalet', etat: 'En cours',
    avancement: { faits: 0, total: 4, pourcentage: 0, etape: 'Pas encore commencé', methode: null },
  });
  assert.equal(texteAvancement(sansNombre), 'Permis et soumissions');
  assert.equal(texteAvancement(zero), 'Pas encore commencé');
});

test('pourcentage nul sans étape : repli n/N', () => {
  const p = projet({
    id: 'd', nom: 'D', categorie: 'Outils', etat: 'En cours',
    avancement: { faits: 0, total: 3, pourcentage: 0, etape: null, methode: null },
  });
  assert.equal(texteAvancement(p), '0/3 jalons · 0 %');
});

test('filtres, compteurs et date', () => {
  const projets = [
    projet({ id: '1', nom: 'Un', categorie: 'Outils', etat: 'En cours' }),
    projet({ id: '2', nom: 'Deux', categorie: 'Chalet', etat: 'Bloqué' }),
    projet({ id: '3', nom: 'Trois', categorie: 'Chalet', etat: 'En cours' }),
  ];
  assert.deepEqual(
    compterParEtat(projets, ['En cours', 'En attente de Martin', 'Livré (à valider)', 'Bloqué']),
    [
      { etat: 'En cours', n: 2 },
      { etat: 'En attente de Martin', n: 0 },
      { etat: 'Livré (à valider)', n: 0 },
      { etat: 'Bloqué', n: 1 },
    ],
  );
  assert.equal(filtrerProjets(projets, 'Chalet', 'En cours').length, 1);
  assert.equal(filtrerProjets(projets, null, null).length, 3);
  assert.equal(formaterMisAJour('2026-10-27'), '27 octobre 2026');
  assert.match(mentionPourcentage(), /jalons faits sur jalons totaux/);
});

test('réponse vide acceptée, réponse illisible refusée', () => {
  assert.deepEqual(validerDossier({ projets: [] })?.projets, []);
  assert.equal(validerDossier(null), null);
  assert.equal(validerDossier({ projets: [{}] }), null);
  const ok = validerDossier({
    titre: 'Martin',
    mis_a_jour: '2026-10-27',
    source: 'maquette',
    etats_possibles: ['En cours'],
    projets: [{
      id: 'x',
      nom: 'Essai',
      categorie: 'Outils',
      etat: 'En cours',
      resume: 'Court.',
      avancement: { faits: 1, total: 2, pourcentage: 50, etape: null, methode: 'jalons' },
      jalons: [{ titre: 'Un', statut: 'fait' }],
      blocages: [],
      en_attente: [{ point: 'Confirmer', qui: 'Martin' }],
      prochaines_etapes: ['Livrer'],
      references: [],
    }],
  });
  assert.equal(ok?.projets[0].en_attente[0].qui, 'Martin');
});

test('la tuile Martin est prioritaire sur Carrière et sur les tuiles Travail', () => {
  const src = readFileSync(join(RACINE, 'app/dashboard/page.tsx'), 'utf8');
  const nombre = (slug: string) => {
    const m = src.match(new RegExp(`${slug}:\\s*(-?\\d+)`));
    assert.ok(m, `priorité manquante pour ${slug}`);
    return Number(m![1]);
  };
  const martin = nombre('martin');
  assert.ok(martin < nombre('carriere'));
  assert.ok(martin < nombre('qscale'));
  assert.ok(martin < nombre('logifox'));
  assert.match(src, /app\.slug === 'martin'\) window\.location\.href = '\/apps\/martin\/'/);
});

test('le client appelle /api/martin/projets avec le jeton, sans dossier embarqué', () => {
  const src = readFileSync(join(RACINE, 'lib/martin-projets-api.ts'), 'utf8');
  assert.match(src, /\/api\/martin\/projets/);
  assert.match(src, /Authorization/);
  assert.match(src, /mc_token/);
  assert.doesNotMatch(src, /STD-OPS-01|POL-COM-16|Soumissions_sauna/);
});

function fichiersLivres(dir: string, acc: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    if (nom === 'node_modules' || nom === '.next' || nom === 'out' || nom === '.git') continue;
    const chemin = join(dir, nom);
    const st = statSync(chemin);
    if (st.isDirectory()) fichiersLivres(chemin, acc);
    else if (/\.(tsx?|jsx?|html|json|md)$/.test(nom) && !nom.endsWith('.test.ts')) acc.push(chemin);
  }
  return acc;
}

test('aucune donnée de la maquette dans le code livré ni dans public/', () => {
  const interdit = ['STD-OPS-01', 'POL-COM-16', 'Soumissions_sauna', 'PLAN-FORM-01'];
  for (const fichier of fichiersLivres(RACINE)) {
    const texte = readFileSync(fichier, 'utf8');
    for (const mot of interdit) {
      assert.equal(texte.includes(mot), false, `${mot} trouvé dans ${fichier}`);
    }
  }
});

test('maquette locale hors paquet : le validateur accepte le dossier réel', () => {
  const candidats = [
    process.env.MARTIN_PROJETS_FIXTURE,
    '/home/ubuntu/.cursor/projects/workspace/uploads/martin_projets_3f5f.json',
  ].filter((p): p is string => !!p);
  const fichier = candidats.find((p) => existsSync(p));
  if (!fichier) {
    return;
  }
  assert.equal(fichier.startsWith(RACINE + '/'), false);
  const dossier = validerDossier(JSON.parse(readFileSync(fichier, 'utf8')));
  assert.ok(dossier);
  assert.equal(dossier!.projets.length, 12);
  assert.equal(dossier!.mis_a_jour, '2026-10-27');
  const chalet = dossier!.projets.find((p) => p.id === 'chalet');
  const std = dossier!.projets.find((p) => p.id === 'std-ops-01');
  assert.ok(chalet && std);
  assert.equal(texteAvancement(chalet!), 'Implantation, permis et soumissions');
  assert.equal(texteAvancement(std!), '4/7 jalons · 57 %');
  const comptes = Object.fromEntries(compterParEtat(dossier!.projets, dossier!.etats_possibles).map((c) => [c.etat, c.n]));
  assert.equal(comptes['En cours'], 4);
  assert.equal(comptes['En attente de Martin'], 7);
  assert.equal(comptes['Livré (à valider)'], 1);
  assert.equal(comptes['Bloqué'], 0);
  assert.equal(filtrerProjets(dossier!.projets, 'Chalet', null).length, 3);
  assert.equal(std!.en_attente[0].qui, 'Martin');
});
