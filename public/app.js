// Interfaz del analizador. Sin dependencias: fetch a la API propia,
// estado en memoria y un historial corto en localStorage.

const $ = (id) => document.getElementById(id);

const EJEMPLOS = {
  negativo:
    "Compré la cafetera hace dos semanas y el primer día funcionó bien, pero desde el jueves gotea por la base y ya manchó la encimera. Escribí al chat de soporte el viernes y nadie me ha contestado. Quiero que me la cambien o me devuelvan el dinero antes de que termine el mes, porque la necesito para el negocio.",
  neutral:
    "Buenas tardes. En la factura de agosto aparece un cargo de 12,90 por 'servicio adicional' que no recuerdo haber contratado. ¿Me pueden indicar a qué corresponde y, si es un error, cómo se corrige? No tengo prisa, pero me gustaría entenderlo antes del próximo cobro. Gracias.",
  positivo:
    "Pasamos tres noches en el hotel por nuestro aniversario y fue perfecto. La habitación estaba impecable, el desayuno era variado y Marta, de recepción, nos consiguió una mesa en el restaurante cuando ya estaba completo. Lo único mejorable es el wifi, que se caía por las noches. Volveremos seguro.",
};

const CLAVE_HISTORIAL = "analizador-ia.historial";
const MAX_HISTORIAL = 5;

let saludable = true;
let maxCaracteres = 8000;
let ultimoResultado = null;

// ---------- Utilidades ----------

function mostrarError(msg) {
  $("error").textContent = msg;
  $("error").classList.remove("oculto");
}
function limpiarError() {
  $("error").classList.add("oculto");
}

function leerHistorial() {
  try {
    const crudo = localStorage.getItem(CLAVE_HISTORIAL);
    return crudo ? JSON.parse(crudo) : [];
  } catch {
    return [];
  }
}
function guardarHistorial(lista) {
  try {
    localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(lista));
  } catch {
    // Modo privado o almacenamiento bloqueado: el historial simplemente no persiste.
  }
}

function haceCuanto(iso) {
  const seg = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 60) return "ahora";
  if (seg < 3600) return `hace ${Math.round(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.round(seg / 3600)} h`;
  return new Date(iso).toLocaleDateString("es");
}

// ---------- Identidad del servidor ----------

function pintarIdentidad(d) {
  $("instancia").textContent = d.instanceId;
  $("zona").textContent = d.availabilityZone;
  $("tipo").textContent = d.instanceType;
  $("modelo").textContent = d.modelo ?? "—";
  if (typeof d.maxCaracteres === "number") {
    maxCaracteres = d.maxCaracteres;
    actualizarContador();
  }
  saludable = d.saludable;
  $("led").className = `led${saludable ? "" : " caida"}`;
  $("estado").textContent = saludable ? "Health check en 200" : "Health check en 503";
  $("alternar").textContent = saludable ? "Apagar health check" : "Encender health check";
}

async function cargarIdentidad() {
  $("led").className = "led consultando";
  $("estado").textContent = "Consultando";
  try {
    const res = await fetch("/api/identidad");
    if (!res.ok) throw new Error(String(res.status));
    pintarIdentidad(await res.json());
  } catch {
    $("estado").textContent = "Sin respuesta del servidor";
    $("led").className = "led caida";
  }
}

// ---------- Formulario ----------

function actualizarContador() {
  const n = $("texto").value.length;
  const c = $("contador");
  c.textContent = `${n} / ${maxCaracteres}`;
  c.classList.toggle("limite", n > maxCaracteres);
}

function ponerCargando(activo) {
  const boton = $("analizar");
  boton.disabled = activo;
  boton.classList.toggle("cargando", activo);
  boton.textContent = activo ? "Analizando" : "Analizar";
  $("texto").disabled = activo;
  $("resultado").setAttribute("aria-busy", String(activo));
}

async function analizar() {
  const texto = $("texto").value.trim();
  if (!texto) {
    mostrarError("Escribe un texto antes de analizar.");
    $("texto").focus();
    return;
  }
  if (texto.length > maxCaracteres) {
    mostrarError(`El texto supera los ${maxCaracteres} caracteres. Recórtalo un poco.`);
    return;
  }
  limpiarError();
  ponerCargando(true);
  try {
    const res = await fetch("/api/analizar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texto }),
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) {
      mostrarError(datos.error ?? `El servidor respondió ${res.status}.`);
      return;
    }
    const entrada = { ...datos, texto, cuando: new Date().toISOString() };
    pintarResultado(entrada);
    añadirAlHistorial(entrada);
    $("resultado").scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch {
    mostrarError("No se pudo contactar al servidor. Revisa que el proceso siga corriendo.");
  } finally {
    ponerCargando(false);
    cargarIdentidad();
  }
}

// ---------- Resultado ----------

function pintarResultado(d) {
  ultimoResultado = d;

  const p = $("sentimiento");
  p.textContent = d.sentimiento;
  p.className = `pastilla ${d.sentimiento}`;

  const estrellas = $("estrellas");
  estrellas.replaceChildren();
  for (let i = 1; i <= 5; i++) {
    const s = document.createElement("span");
    s.textContent = "★";
    if (i <= d.puntuacion) s.classList.add("llena");
    estrellas.appendChild(s);
  }
  estrellas.setAttribute("aria-label", `Puntuación ${d.puntuacion} de 5`);

  const u = $("urgencia");
  u.textContent = `urgencia ${d.urgencia}`;
  u.className = `urgencia ${d.urgencia}`;

  $("resumen").textContent = d.resumen;
  $("temas").replaceChildren(
    ...d.temas.map((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      return li;
    }),
  );
  $("respuesta").textContent = d.respuesta_sugerida;

  $("pie-instancia").textContent = `atendido por ${d.atendidoPor}`;
  $("pie-modelo").textContent = d.modelo ?? "";
  $("pie-tiempo").textContent = d.milisegundos ? `${(d.milisegundos / 1000).toFixed(1)} s` : "";
  $("pie-tokens").textContent = d.tokens ? `${d.tokens.entrada} tokens de entrada · ${d.tokens.salida} de salida` : "";
  $("resultado").classList.remove("oculto");
}

async function copiarRespuesta() {
  if (!ultimoResultado) return;
  const boton = $("copiar");
  try {
    await navigator.clipboard.writeText(ultimoResultado.respuesta_sugerida);
    boton.textContent = "Copiado";
  } catch {
    boton.textContent = "No se pudo copiar";
  }
  setTimeout(() => (boton.textContent = "Copiar"), 1800);
}

// ---------- Historial ----------

function añadirAlHistorial(entrada) {
  const lista = [entrada, ...leerHistorial()].slice(0, MAX_HISTORIAL);
  guardarHistorial(lista);
  pintarHistorial(lista);
}

function pintarHistorial(lista = leerHistorial()) {
  const seccion = $("historial");
  const ol = $("historial-lista");
  if (lista.length === 0) {
    seccion.classList.add("oculto");
    return;
  }
  ol.replaceChildren(
    ...lista.map((e, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.title = "Volver a ver este resultado";
      const pastilla = document.createElement("span");
      pastilla.className = `pastilla ${e.sentimiento}`;
      pastilla.textContent = e.sentimiento;
      const texto = document.createElement("span");
      texto.className = "texto";
      texto.textContent = e.resumen;
      const cuando = document.createElement("span");
      cuando.className = "cuando";
      cuando.textContent = haceCuanto(e.cuando);
      b.append(pastilla, texto, cuando);
      b.addEventListener("click", () => {
        $("texto").value = e.texto ?? "";
        actualizarContador();
        pintarResultado(e);
        $("resultado").scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      li.appendChild(b);
      return li;
    }),
  );
  seccion.classList.remove("oculto");
}

// ---------- Eventos ----------

$("formulario").addEventListener("submit", (ev) => {
  ev.preventDefault();
  analizar();
});
$("texto").addEventListener("input", () => {
  limpiarError();
  actualizarContador();
});
$("texto").addEventListener("keydown", (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
    ev.preventDefault();
    analizar();
  }
});
$("limpiar").addEventListener("click", () => {
  $("texto").value = "";
  actualizarContador();
  limpiarError();
  $("resultado").classList.add("oculto");
  $("texto").focus();
});
for (const chip of document.querySelectorAll(".chip[data-ejemplo]")) {
  chip.addEventListener("click", () => {
    $("texto").value = EJEMPLOS[chip.dataset.ejemplo];
    actualizarContador();
    limpiarError();
    $("texto").focus();
  });
}
$("copiar").addEventListener("click", copiarRespuesta);
$("refrescar").addEventListener("click", cargarIdentidad);
$("borrar-historial").addEventListener("click", () => {
  guardarHistorial([]);
  pintarHistorial([]);
});
$("alternar").addEventListener("click", async () => {
  await fetch("/api/salud", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ activa: !saludable }),
  });
  cargarIdentidad();
});

// ---------- Arranque ----------

actualizarContador();
pintarHistorial();
cargarIdentidad();
