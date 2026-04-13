import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function Home() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <section className="flex flex-col items-center gap-4">
      <h1 className="text-3xl font-bold">Home</h1>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          className="rounded border border-gray-300 px-3 py-2"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          Greet
        </button>
      </form>
      {greetMsg && <p className="text-lg">{greetMsg}</p>}
    </section>
  );
}

export default Home;
