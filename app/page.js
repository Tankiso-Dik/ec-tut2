import Chatbot from "./components/Chatbot";

export default function Page() {
  return (
    <main className="ec-shell">
      <iframe
        title="Electronic Campus Snapshot"
        src="/original-snapshot.html"
        className="ec-frame"
      />
      <Chatbot />
    </main>
  );
}
