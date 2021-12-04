/* eslint-env browser */

import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { MonacoBinding } from 'y-monaco'
import * as monaco from 'monaco-editor'

function sleep(s) {
  return new Promise((resolve) => setTimeout(resolve, s));
}

async function main() {
  let pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.18.1/full/",
  });
  let namespace = pyodide.globals.get("dict")();
  pyodide.runPython(
    `
      import sys
      from pyodide import to_js
      from pyodide.console import PyodideConsole, repr_shorten
      import __main__
      pyconsole = PyodideConsole(__main__.__dict__)
      import builtins
      async def await_fut(fut):
        res = await fut
        if res is not None:
          builtins._ = res
        return to_js([res], depth=1)
      def clear_console():
        pyconsole.buffer = []
    `,
    namespace
  );
  let repr_shorten = namespace.get("repr_shorten");
  let await_fut = namespace.get("await_fut");
  let pyconsole = namespace.get("pyconsole");
  let clear_console = namespace.get("clear_console");
  namespace.destroy();

  let ps1 = ">>> ",
    ps2 = "... ";

  async function lock() {
    let resolve;
    let ready = term.ready;
    term.ready = new Promise((res) => (resolve = res));
    await ready;
    return resolve;
  }

  async function interpreter(command) {
    let unlock = await lock();
    term.pause();
    // multiline should be splitted (useful when pasting)
    for (const c of command.split("\n")) {
      let fut = pyconsole.push(c);
      term.set_prompt(fut.syntax_check === "incomplete" ? ps2 : ps1);
      switch (fut.syntax_check) {
        case "syntax-error":
          term.error(fut.formatted_error.trimEnd());
          continue;
        case "incomplete":
          continue;
        case "complete":
          break;
        default:
          throw new Error(`Unexpected type ${ty}`);
      }
      // In JavaScript, await automatically also awaits any results of
      // awaits, so if an async function returns a future, it will await
      // the inner future too. This is not what we want so we
      // temporarily put it into a list to protect it.
      let wrapped = await_fut(fut);
      // complete case, get result / error and print it.
      try {
        let [value] = await wrapped;
        if (value !== undefined) {
          term.echo(
            repr_shorten.callKwargs(value, {
              separator: "\n[[;orange;]<long output truncated>]\n",
            })
          );
        }
        if (pyodide.isPyProxy(value)) {
          value.destroy();
        }
      } catch (e) {
        if (e.constructor.name === "PythonError") {
          term.error(fut.formatted_error.trimEnd());
        } else {
          throw e;
        }
      } finally {
        fut.destroy();
        wrapped.destroy();
      }
    }
    term.resume();
    await sleep(10);
    unlock();
  }

  let term = $(".terminal").terminal(interpreter, {
    greetings: "",
    prompt: ps1,
    completionEscape: false,
    completion: function (command, callback) {
      callback(pyconsole.complete(command).toJs()[0]);
    },
    keymap: {
      "CTRL+C": async function (event, original) {
        clear_console();
        term.echo_command();
        term.echo("KeyboardInterrupt");
        term.set_command("");
        term.set_prompt(ps1);
      },
    },
  });
  pyconsole.stdout_callback = (s) => term.echo(s, { newline: false });
  pyconsole.stderr_callback = (s) => {
    term.error(s.trimEnd());
  };
  term.ready = Promise.resolve();
  pyodide._module.on_fatal = async (e) => {
    term.error(
      "Pyodide has suffered a fatal error. Please report this to the Pyodide maintainers."
    );
    term.error("The cause of the fatal error was:");
    term.error(e);
    term.error("Look in the browser console for more details.");
    await term.ready;
    term.pause();
    await sleep(15);
    term.pause();
  };

  $(".run").click(async () => {
    term.echo("Running...");
    let text = editor.getValue();
    // Adding new line in case code did not have one.
    await interpreter(text + "\n");
    term.echo();
  });

}
window.console_ready = main();

window.addEventListener('load', () => {
  const ydoc = new Y.Doc()
  const provider = new WebrtcProvider('py-interview-tool-master', ydoc)
  const ytext = ydoc.getText('monaco')

  const editor = monaco.editor.create(/** @type {HTMLElement} */ (document.getElementById('editor')), {
    value: '',
    language: 'python',
    theme: 'vs-dark',
    minimap: { enabled: false },
  })
  new MonacoBinding(
    ytext,
    /** @type {monaco.editor.ITextModel} */ (editor.getModel()),
    new Set([editor]),
    provider.awareness,
  )
})
