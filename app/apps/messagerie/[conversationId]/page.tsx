import Thread from './Thread';

export const metadata = {
  title: 'Conversation — Mission Control',
};

export default function ThreadPage({ params }: { params: { conversationId: string } }) {
  const id = Number.parseInt(params.conversationId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-300">
        Conversation invalide.
      </main>
    );
  }
  return <Thread conversationId={id} />;
}
