'use client';

// ACCUEIL — bande projet mince + tuiles + dernière activité.
// Données : GET /projet-chalet/accueil (déjà chargé par la coquille, via useChalet().accueil).
// Les tuiles (nom, icône, couleur, ordre) viennent de la table ChaletSection, filtrées
// par le backend selon ce que la personne a le droit de voir.
// La boîte de dépôt n'est volontairement PAS mise en avant ici (demande Martin) :
// elle est dans la barre du bas, avec une pastille.

import { useChalet, Icone, type EcranProps } from '../_kit/ui';
import { quand } from '@/lib/projet-chalet-api';

export default function Accueil(_: EcranProps) {
  const { accueil, aller } = useChalet();
  if (!accueil) return null;
  const { projet, sections, activite } = accueil;

  return (
    <>
      <div className="pc-bande">
        <a href="/dashboard/" className="pc-icobtn" aria-label="Retour au portail" style={{ minWidth: 28, height: 28 }}>
          <Icone nom="grip" />
        </a>
        <b>{projet.nom}</b>
        {projet.avancement !== null && (
          <>
            <span className="pc-barre" role="img" aria-label={`Avancement banque ${projet.avancement} %`}>
              <i style={{ width: `${Math.min(100, projet.avancement)}%` }} />
            </span>
            <span className="pc-cote" style={{ color: 'var(--pc-sapin)' }}>{projet.avancement} %</span>
          </>
        )}
      </div>

      <div className="pc-tuiles">
        {sections.map((s) => (
          <button key={s.slug} className="pc-tuile" onClick={() => aller(s.slug)}>
            <span className="pc-ico" style={{ background: s.couleur }}><Icone nom={s.icone} /></span>
            <b>{s.nom}</b>
            {s.aide && <small>{s.aide}</small>}
          </button>
        ))}
      </div>
      {sections.length === 0 && <div className="pc-vide">Aucune section n'est partagée avec toi pour l'instant.</div>}

      {activite.length > 0 && (
        <>
          <div className="pc-section-titre">
            <h3>Dernière activité</h3>
            <button className="pc-lien" onClick={() => aller('activite')}>Tout voir</button>
          </div>
          <div className="pc-liste">
            {activite.slice(0, 3).map((a) => (
              <div key={a.id} className="pc-ligne leger">
                <span className="pc-pt pc-c-info"><Icone nom={a.icone} /></span>
                <span className="pc-txt"><b>{a.texte}</b><small>{quand(a.createdAt)}</small></span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
