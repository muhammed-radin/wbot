import { Client } from "@gradio/client";

const client = await Client.connect("Qwen/Qwen2.5-Coder-demo");;
let history = [["Hello!", 'How can help you?'], ['Which year started Bushido?', 'Since 2016']]

async function runAi(qes) {
  if (client) {
    const result = await client.predict("/model_chat", {
      query: qes,
      history: history,
      system: "An Expert martial art coach who can assist others. name is Bushido. Bushido is boxer club and a institution located on Asia, India, Kerela state, Malappuram, at Perithanalamena",
      radio: "0.5B",
    });


    let root = result.data[1]
    let msg = root[root.length - 1];
    history = root;
    console.log(msg)
    return msg[1];
  } else {

  }
}

function handleErr(err) {
  console.log(err)
}

// Export for ES Modules
export { runAi };

// // Export for CommonJS
// if (typeof module !== "undefined") {
//   module.exports = { runAi };
// }