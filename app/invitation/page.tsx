'use client';

// INVITATION — page publique où un invité du Projet chalet (entrepreneur, designer…)
// crée son compte à partir du lien reçu : /invitation/?code=CHALET-XXXXXXXX
// Routes : GET /projet-chalet/invitation/:code (aperçu), POST (création du compte).
// Le compte créé est de profil GUEST : il ne voit que les tuiles cochées pour lui, en lecture seule.

import { useEffect, useState } from 'react';
import { ProjetChaletAPI } from '@/lib/projet-chalet-api';
import { THEME_CSS } from '../apps/projet-chalet/_kit/theme';

export default function InvitationPage() {
  const [code, setCode] = useState('');
  const [invite, setInvite] = useState<{ nom: string; detail: string | null } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [fait, setFait] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('code') || '';
    setCode(c);
    if (!c) { setErreur("Il manque le code d'invitation dans le lien."); return; }
    ProjetChaletAPI.invitation(c).then(setInvite).catch((e) => setErreur(e?.message || 'Invitation introuvable.'));
  }, []);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (password !== password2) { setErreur('Les deux mots de passe ne sont pas pareils.'); return; }
    setEnvoi(true);
    try {
      const r = await ProjetChaletAPI.accepterInvitation(code, username.trim(), password);
      setFait(r.username);
    } catch (e: any) {
      setErreur(e?.message || 'Création du compte impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="pc">
      <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
      <main className="pc-vue" style={{ paddingTop: 40 }}>
        <div className="pc-surtitre">Projet chalet</div>
        <h2 style={{ fontSize: 26, margin: '4px 0 12px' }}>Invitation</h2>

        {fait ? (
          <>
            <p>Ton compte <b>{fait}</b> est créé. Connecte-toi avec ce nom d'utilisateur et ton mot de passe.</p>
            <a className="pc-btn" href="/">Me connecter</a>
          </>
        ) : invite ? (
          <form onSubmit={creer}>
            <p>Bonjour <b>{invite.nom}</b>{invite.detail ? ` (${invite.detail})` : ''}. Choisis ton nom d'utilisateur et ton mot de passe pour accéder au projet.</p>
            <div className="pc-champ">
              <label htmlFor="inv-user">Nom d'utilisateur (3 caractères ou plus, sans espace)</label>
              <input id="inv-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={40} pattern="[A-Za-z0-9._\-]+" />
            </div>
            <div className="pc-champ">
              <label htmlFor="inv-pass">Mot de passe (8 caractères ou plus)</label>
              <input id="inv-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
            </div>
            <div className="pc-champ">
              <label htmlFor="inv-pass2">Confirme le mot de passe</label>
              <input id="inv-pass2" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" required minLength={8} />
            </div>
            {erreur && <div className="pc-erreur" role="alert" style={{ marginBottom: 12 }}>{erreur}</div>}
            <button className="pc-btn" type="submit" disabled={envoi}>{envoi ? 'Création…' : 'Créer mon compte'}</button>
          </form>
        ) : erreur ? (
          <div className="pc-erreur" role="alert">{erreur}</div>
        ) : (
          <p className="pc-muted">Chargement…</p>
        )}
      </main>
    </div>
  );
}
