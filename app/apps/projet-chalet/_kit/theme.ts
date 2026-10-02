// Thème « carnet de chantier » de Projet chalet (repris de Notre Chalet : papier,
// sapin, lac, bois). Clair par défaut, sombre automatique selon le téléphone.
// Tout est préfixé .pc pour ne rien changer au reste du portail.
// Les couleurs passent TOUJOURS par les variables (--pc-...) : jamais de couleur en dur
// dans un écran, sinon le mode sombre casse.

export const THEME_CSS = `
.pc {
  --pc-papier:#f6f1e7; --pc-carte:#fffdf8; --pc-encre:#1f2a24; --pc-gris:#6b6f63; --pc-ligne:#e4dccb;
  --pc-sapin:#2d6a4f; --pc-sur-sapin:#ffffff; --pc-lac:#1d7a8c; --pc-bois:#b45309;
  --pc-ok:#2f7d32; --pc-warn:#9a6412; --pc-bad:#b42318;
  --pc-voile:rgba(20,25,22,.38);
  --pc-f-titre:"Bricolage Grotesque",ui-sans-serif,system-ui,sans-serif;
  --pc-f-texte:"Figtree",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --pc-f-cote:"JetBrains Mono",ui-monospace,Consolas,monospace;
  color-scheme: light;
  background: var(--pc-papier); color: var(--pc-encre);
  font-family: var(--pc-f-texte); font-size: 15px; line-height: 1.45;
  min-height: 100dvh;
}
@media (prefers-color-scheme: dark) {
  .pc {
    --pc-papier:#141b17; --pc-carte:#1c2520; --pc-encre:#ece6d8; --pc-gris:#a3a796; --pc-ligne:#2c3830;
    --pc-sapin:#5fb08a; --pc-sur-sapin:#0f1712; --pc-lac:#4fb3c6; --pc-bois:#e08a3c;
    --pc-ok:#6cc070; --pc-warn:#e0b04a; --pc-bad:#f07a6e; --pc-voile:rgba(0,0,0,.55);
    color-scheme: dark;
  }
}
.pc *, .pc *::before, .pc *::after { box-sizing: border-box; }
.pc h1, .pc h2, .pc h3 { font-family: var(--pc-f-titre); margin: 0; text-wrap: balance; }
.pc button { font: inherit; color: inherit; cursor: pointer; }
/* Seuls les liens « texte » (sans classe) sont bleus ; un lien stylé en bouton/ligne garde sa couleur */
.pc a:not([class]), .pc a.pc-lien { color: var(--pc-lac); }
.pc :focus-visible { outline: 2px solid var(--pc-lac); outline-offset: 2px; }
.pc img { max-width: 100%; }

/* Colonne centrale : pleine largeur sur téléphone, 560 px max sur ordi */
.pc-vue { max-width: 760px; margin: 0 auto; padding: calc(env(safe-area-inset-top, 0px) + 10px) 16px calc(env(safe-area-inset-bottom, 0px) + 96px); }

/* Barre d'onglets du bas */
.pc-tabbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; background: var(--pc-carte); border-top: 1px solid var(--pc-ligne);
  padding: 6px 6px calc(env(safe-area-inset-bottom, 0px) + 8px); }
.pc-tabbar-in { max-width: 760px; margin: 0 auto; display: grid; grid-template-columns: repeat(5, 1fr); }
.pc-tab { background: none; border: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 11px; color: var(--pc-gris); padding: 4px 0; }
.pc-tab svg { font-size: 19px; }
.pc-tab.on { color: var(--pc-sapin); font-weight: 700; }
.pc-bulle { position: relative; display: inline-flex; }
.pc-bulle b { position: absolute; top: -6px; right: -11px; background: var(--pc-bois); color: #fff; font-size: 10px; min-width: 16px; height: 16px; border-radius: 8px; display: grid; place-items: center; padding: 0 3px; }

/* En-tête d'écran */
.pc-entete { display: flex; align-items: center; gap: 10px; padding: 4px 0 14px; }
.pc-entete h2 { font-size: 23px; font-weight: 800; letter-spacing: -.01em; flex: 1; min-width: 0; overflow-wrap: anywhere; }
.pc-retour { background: var(--pc-carte); border: 1px solid var(--pc-ligne); width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; flex: 0 0 auto; }
.pc-icobtn { background: none; border: 0; min-width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; color: var(--pc-lac); flex: 0 0 auto; }

.pc-surtitre { font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--pc-gris); font-weight: 700; }
.pc-muted { color: var(--pc-gris); }
.pc-petit { font-size: 12.5px; }
.pc-cote { font-family: var(--pc-f-cote); font-size: 12.5px; font-variant-numeric: tabular-nums; }

/* Bande projet (une seule ligne mince) */
.pc-bande { display: flex; align-items: center; gap: 10px; padding: 4px 2px 2px; font-size: 12.5px; color: var(--pc-gris); }
.pc-bande b { color: var(--pc-encre); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.pc-bande .pc-barre { flex: 1; min-width: 50px; height: 4px; }
.pc-barre { height: 8px; border-radius: 4px; background: var(--pc-ligne); overflow: hidden; }
.pc-barre i { display: block; height: 100%; background: var(--pc-sapin); border-radius: 4px; }

/* Tuiles */
/* Tuiles : grandes et adaptées à l'écran — 2 colonnes sur téléphone, 3 ou 4 sur tablette/ordi (demande Martin 2026-10-02) */
.pc-tuiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 14px; }
.pc-tuile { background: var(--pc-carte); border: 1px solid var(--pc-ligne); border-radius: 18px; padding: 16px 14px 14px; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; text-align: left; min-height: 140px; position: relative; }
.pc-tuile:active { transform: scale(.97); }
.pc-tuile .pc-ico { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; font-size: 21px; color: #fff; }
.pc-tuile b { font-size: 16.5px; line-height: 1.2; overflow-wrap: anywhere; }
.pc-tuile small { font-size: 12.5px; color: var(--pc-gris); line-height: 1.3; }
.pc-pastille { position: absolute; top: 9px; right: 9px; background: var(--pc-bois); color: #fff; font-size: 10.5px; font-weight: 700; border-radius: 9px; padding: 1px 6px; }

.pc-section-titre { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin: 20px 0 8px; }
.pc-section-titre h3 { font-size: 16px; font-weight: 700; }
.pc-lien { background: none; border: 0; color: var(--pc-lac); font-weight: 600; font-size: 13px; padding: 0; }

/* Listes */
.pc-liste { background: var(--pc-carte); border: 1px solid var(--pc-ligne); border-radius: 18px; overflow: hidden; }
.pc-ligne { display: flex; gap: 12px; align-items: center; padding: 12px 14px; border: 0; border-bottom: 1px solid var(--pc-ligne); width: 100%; background: none; text-align: left; color: inherit; text-decoration: none; }
.pc-ligne:last-child { border-bottom: 0; }
.pc-ligne .pc-txt { flex: 1; min-width: 0; }
.pc-ligne .pc-txt b { display: block; font-size: 14.5px; font-weight: 600; overflow-wrap: anywhere; }
.pc-ligne .pc-txt small { display: block; color: var(--pc-gris); font-size: 12.5px; overflow-wrap: anywhere; }
.pc-ligne.leger .pc-txt b { font-weight: 500; font-size: 14px; } /* lignes d'activité : texte courant, pas un titre */
.pc-pt { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; flex: 0 0 auto; font-size: 15px; }

/* Puces d'état */
.pc-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; border-radius: 999px; padding: 3px 9px; white-space: nowrap; }
.pc-c-ok { background: color-mix(in srgb, var(--pc-ok) 15%, transparent); color: var(--pc-ok); }
.pc-c-warn { background: color-mix(in srgb, var(--pc-warn) 18%, transparent); color: var(--pc-warn); }
.pc-c-bad { background: color-mix(in srgb, var(--pc-bad) 14%, transparent); color: var(--pc-bad); }
.pc-c-info { background: color-mix(in srgb, var(--pc-lac) 14%, transparent); color: var(--pc-lac); }
.pc-c-neutre { background: color-mix(in srgb, var(--pc-gris) 14%, transparent); color: var(--pc-gris); }

.pc-segment { display: flex; background: var(--pc-carte); border: 1px solid var(--pc-ligne); border-radius: 14px; padding: 3px; gap: 3px; margin-bottom: 12px; }
.pc-segment button { flex: 1; border: 0; background: none; border-radius: 11px; padding: 8px 0; font-weight: 600; font-size: 13px; color: var(--pc-gris); }
.pc-segment button.on { background: var(--pc-sapin); color: var(--pc-sur-sapin); }

/* Boutons */
.pc-btn { border: 0; border-radius: 14px; padding: 12px 14px; font-weight: 700; background: var(--pc-sapin); color: var(--pc-sur-sapin); width: 100%; display: flex; gap: 8px; justify-content: center; align-items: center; text-decoration: none; }
.pc-btn:disabled { opacity: .55; cursor: default; }
.pc-btn.second { background: var(--pc-carte); color: var(--pc-encre); border: 1px solid var(--pc-ligne); }
.pc-btn.danger { background: var(--pc-carte); color: var(--pc-bad); border: 1px solid color-mix(in srgb, var(--pc-bad) 40%, transparent); }
.pc-btn.petit { width: auto; padding: 8px 12px; font-size: 13px; border-radius: 11px; }
.pc-rangee { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

/* Formulaires */
.pc-champ { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.pc-champ label { font-size: 12.5px; font-weight: 700; color: var(--pc-gris); }
.pc-champ input, .pc-champ textarea, .pc-champ select { font: inherit; font-size: 16px; background: var(--pc-carte); color: var(--pc-encre); border: 1px solid var(--pc-ligne); border-radius: 12px; padding: 10px 12px; width: 100%; }
.pc-champ textarea { min-height: 80px; resize: vertical; }
.pc-depose { border: 1.5px dashed var(--pc-lac); border-radius: 16px; padding: 18px; text-align: center; color: var(--pc-lac); background: color-mix(in srgb, var(--pc-lac) 6%, transparent); display: block; cursor: pointer; }
.pc-depose input { display: none; }
.pc-case { display: flex; align-items: center; gap: 12px; }
.pc-case input[type=checkbox] { width: 20px; height: 20px; accent-color: var(--pc-sapin); flex: 0 0 auto; }

/* Cartes et blocs */
.pc-carte { background: var(--pc-carte); border: 1px solid var(--pc-ligne); border-radius: 14px; padding: 10px 12px; margin-bottom: 8px; }
.pc-meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; color: var(--pc-gris); margin-top: 6px; flex-wrap: wrap; }
.pc-note-claude { border-left: 3px solid var(--pc-lac); background: color-mix(in srgb, var(--pc-lac) 7%, transparent); border-radius: 0 12px 12px 0; padding: 8px 10px; font-size: 12.5px; margin-top: 6px; overflow-wrap: anywhere; }
.pc-alerte { background: color-mix(in srgb, var(--pc-warn) 14%, transparent); color: var(--pc-warn); border-radius: 12px; padding: 8px 10px; font-size: 12.5px; font-weight: 600; display: flex; gap: 8px; align-items: center; }
.pc-erreur { background: color-mix(in srgb, var(--pc-bad) 12%, transparent); color: var(--pc-bad); border-radius: 12px; padding: 10px 12px; font-size: 13.5px; }
.pc-vide { text-align: center; color: var(--pc-gris); padding: 22px 10px; font-size: 13.5px; }
.pc-kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pc-kpi { background: var(--pc-carte); border: 1px solid var(--pc-ligne); border-radius: 16px; padding: 12px; min-width: 0; }
.pc-kpi b { display: block; font-family: var(--pc-f-cote); font-size: 16px; margin-top: 2px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.pc-grille-photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.pc-grille-photos button { padding: 0; border: 0; background: var(--pc-ligne); border-radius: 10px; overflow: hidden; aspect-ratio: 1; }
.pc-grille-photos img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* Feuille du bas (modale) */
.pc-voile { position: fixed; inset: 0; background: var(--pc-voile); z-index: 40; display: flex; align-items: flex-end; justify-content: center; }
.pc-feuille { background: var(--pc-papier); width: 100%; max-width: 640px; border-radius: 24px 24px 0 0; padding: 10px 16px calc(env(safe-area-inset-bottom, 0px) + 24px); max-height: 90dvh; overflow-y: auto; }
.pc-poignee { width: 40px; height: 5px; border-radius: 3px; background: var(--pc-ligne); margin: 0 auto 12px; }
.pc-feuille h3 { font-size: 19px; margin-bottom: 10px; }

.pc-toast { position: fixed; left: 16px; right: 16px; bottom: calc(env(safe-area-inset-bottom, 0px) + 84px); max-width: 728px; margin: 0 auto; background: var(--pc-encre); color: var(--pc-papier); border-radius: 14px; padding: 11px 14px; font-size: 13.5px; z-index: 60; display: flex; gap: 8px; align-items: center; }

/* Lecteur de documents */
.pc-lecteur { border-radius: 14px; border: 1px solid var(--pc-ligne); background: var(--pc-carte); overflow: hidden; }
.pc-lecteur iframe, .pc-lecteur object { width: 100%; height: 70dvh; border: 0; display: block; background: #fff; }
.pc-lecteur img { width: 100%; display: block; }
.pc-vchips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; margin: 0 0 10px; scrollbar-width: none; }
.pc-vchips button { flex: 0 0 auto; border: 1px solid var(--pc-ligne); background: var(--pc-carte); border-radius: 999px; padding: 6px 12px; font-family: var(--pc-f-cote); font-size: 12px; }
.pc-vchips button.on { background: var(--pc-sapin); border-color: var(--pc-sapin); color: var(--pc-sur-sapin); }
/* Plans & devis — écran d'un document (2026-10-02) : carte « version courante » qui ouvre le plan,
   lignes à 2 zones (zone principale cliquable + bouton à droite) */
.pc-courante { background: var(--pc-carte); border: 1.5px solid var(--pc-sapin); border-radius: 18px; padding: 14px; }
.pc-courante-lien { display: flex; gap: 14px; align-items: center; color: inherit; text-decoration: none; }
.pc-courante-lien .pc-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pc-courante-lien b { font-size: 16px; overflow-wrap: anywhere; }
.pc-courante-lien small { color: var(--pc-gris); font-size: 12.5px; }
.pc-gros-ico { width: 52px; height: 52px; border-radius: 14px; background: color-mix(in srgb, var(--pc-sapin) 16%, transparent); color: var(--pc-sapin); display: grid; place-items: center; font-size: 24px; flex: 0 0 auto; }
.pc-btn.grand { padding: 15px; font-size: 16.5px; border-radius: 16px; }
.pc-2l { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pc-ligne-lien { display: flex; gap: 12px; align-items: center; flex: 1; min-width: 0; background: none; border: 0; padding: 0; text-align: left; color: inherit; text-decoration: none; font: inherit; cursor: pointer; }
.pc-ligne-lien .pc-txt { flex: 1; min-width: 0; }
.pc-ligne-lien .pc-txt b { display: block; font-size: 14.5px; font-weight: 600; overflow-wrap: anywhere; }
.pc-ligne-lien .pc-txt small { display: block; color: var(--pc-gris); font-size: 12.5px; overflow-wrap: anywhere; }
.pc-ouvrir { width: 44px; height: 44px; border-radius: 50%; background: var(--pc-sapin); color: var(--pc-sur-sapin); display: grid; place-items: center; flex: 0 0 auto; font-size: 17px; text-decoration: none; }

.pc-chargement { display: grid; place-items: center; min-height: 40vh; color: var(--pc-gris); }

/* Téléphone : 2 tuiles par rangée ; une tuile seule en fin de liste prend toute la largeur */
@media (max-width: 520px) {
  .pc-tuiles { grid-template-columns: 1fr 1fr; }
  .pc-tuiles > .pc-tuile:last-child:nth-child(odd) { grid-column: 1 / -1; min-height: 0; flex-direction: row; align-items: center; gap: 14px; }
}
@media (max-width: 340px) { .pc-tuiles { grid-template-columns: 1fr 1fr; gap: 8px; } .pc-tuile { padding: 12px 10px; min-height: 120px; } }
@media (prefers-reduced-motion: reduce) { .pc * { transition: none !important; animation: none !important; } }
`;
