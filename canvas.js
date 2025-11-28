// Cambie las variables scale para aumentar o reducir las dimensiones de la malla
// Se recomienda fuertemente valores NO MENORES a 0.5 ademas de no modificar mucho scaleY
var scaleX, scaleY, canvas, tipoRamo;

// variables de mensaje
var welcomeTitle, welcomeDesc;

// verificamos que malla busca
var current_malla = "ELI";
if (window.location.search) {
  var params = new URLSearchParams(window.location.search);
  if (params.has("m")) current_malla = params.get("m");
}

if (d3.select(".canvas")._groups[0][0]) {
  scaleX = 1;
  scaleY = 1;
  canvas = d3.select(".canvas");
  tipoRamo = Ramo;
  welcomeTitle = "¡Bienvenido a la Malla Interactiva de ";
  welcomeDesc =
    "Puedes tachar tus ramos aprobados haciendo click sobre ellos.\n" +
    "A medida que vas aprobando ramos, se van liberando los que tienen prerrequisitos.\n" +
    "Haz click en cualquier lado para comenzar.";
}

var height = 730 * scaleX,
  width = 1570 * scaleY;

canvas = canvas
  .append("svg")
  .attr("width", width)
  .attr("height", height);

var carreras = {
  ELI: " Ing. Civil Eléctrica PUCV",
  ELI4: "Ing. Eléctrica PUCV",
  ELO: "Ing. Civil Electrónica PUCV",
};

/* ---------- axis ---------- */
var drawer = canvas.append("g").attr("transform", "translate(10, 20)");

var globalY = 0;
var globalX = 0;
var _semester = 1;
var _s = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
];

var malla = {};
var all_ramos = {};
var total_creditos = 0;
var total_ramos = 0;
let id = 1;

// si no existe #carrera no pasa nada
$("#carrera").text(carreras[current_malla]);

/*
 * MAT: Matemáticas
 * FIS: Físicas
 * FIN: Humanistas
 * FOFU: FOFUS
 * ING: Inglés
 * ICM: ICM y DER
 * EIE: Eléctrica
 * EII: Industrial
 */
d3.queue()
  .defer(d3.json, "data/data_" + current_malla + ".json")
  .defer(d3.json, "data/colors_" + current_malla + ".json")
  .await(main_function);

function main_function(error, data, colorBySector) {
  if (error) {
    console.log(error);
    $(".canvas").prepend(
      "<h1>OPS!, malla no encontrada, <a href='http://labcomp.cl/~saedo/apps/viz/ramos'>Volver al inicio</a></h1>"
    );
    return;
  }

  // ---- cargar datos de la malla ----
  let longest_semester = 0;
  for (var semester in data) {
    malla[semester] = {};

    if (data[semester].length > longest_semester)
      longest_semester = data[semester].length;

    data[semester].forEach(function (ramo) {
      malla[semester][ramo[1]] = new tipoRamo(
        ramo[0],
        ramo[1],
        ramo[2],
        ramo[3],
        ramo.length > 4 ? ramo[4] : [],
        id++,
        colorBySector
      );
      all_ramos[ramo[1]] = malla[semester][ramo[1]];
      total_creditos += ramo[2];
      total_ramos++;
    });
  }

  // ---- ajustar tamaño del SVG según malla ----
  width = 130 * Object.keys(malla).length * scaleX + 10;
  height = (110 * longest_semester + 30 + 25) * scaleY + 10;

  canvas.attr("width", width).attr("height", height);
  drawer.attr("width", width).attr("height", height);

  // --------- Colores personalizados (localStorage + pickers) ----------
  var colorsStorageKey = "colors_" + current_malla;

  // Intentar cargar colores guardados
  if (localStorage[colorsStorageKey]) {
    try {
      var savedColors = JSON.parse(localStorage[colorsStorageKey]);
      Object.keys(savedColors).forEach(function (key) {
        if (colorBySector[key]) {
          colorBySector[key][0] = savedColors[key];
        }
      });
    } catch (e) {
      console.warn("No se pudieron cargar los colores guardados", e);
    }
  }

  var colorDescContainer = d3.select(".color-description");
  if (colorDescContainer._groups[0][0]) {
    colorDescContainer.html("");

    colorDescContainer
      .append("p")
      .style("width", "100%")
      .style("text-align", "center")
      .style("margin", "5px 0 10px 0")
      .text("Personalizar colores por tipo de ramo:");

    var itemsWrapper = colorDescContainer
      .append("div")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("justify-content", "center");

    Object.keys(colorBySector).forEach(function (key) {
      var colorItem = itemsWrapper
        .append("div")
        .attr("class", "color-item")
        .attr("data-sector", key)
        .attr(
          "style",
          "display:flex;align-items:center;margin-right:15px;margin-bottom:5px;"
        );

      var circleSvg = colorItem.append("svg").attr("height", 25).attr("width", 25);

      circleSvg
        .append("circle")
        .attr("r", 10)
        .attr("cx", 12)
        .attr("cy", 12)
        .attr("fill", colorBySector[key][0]);

      colorItem
        .append("span")
        .text(colorBySector[key][1])
        .style("margin-left", "5px");

      colorItem
        .append("input")
        .attr("type", "color")
        .attr("class", "color-picker")
        .attr("value", colorBySector[key][0])
        .attr("data-sector", key)
        .style("margin-left", "8px")
        .on("input", function () {
          var sector = this.getAttribute("data-sector");
          var newColor = this.value;
          updateSectorColor(sector, newColor, colorBySector, colorsStorageKey);
        });
    });

    // botón reset colores
    d3.select("#resetColors").on("click", function () {
      resetColors(colorBySector, colorsStorageKey);
    });

    // botón exportar PDF
    d3.select("#downloadPDF").on("click", function () {
      exportToPDF();
    });
  }

  // --------- Dibujo de la malla + encabezados clickeables ----------
  for (let semester in malla) {
    globalY = 0;

    // encabezado gris con número romano
    const headerGroup = drawer
      .append("g")
      .attr("class", "semester-header")
      .attr("data-semester", semester);

    headerGroup
      .append("rect")
      .attr("x", globalX)
      .attr("y", globalY)
      .attr("width", 120 * scaleX)
      .attr("height", 30 * scaleY)
      .attr("fill", "gray");

    headerGroup
      .append("text")
      .attr("x", globalX + (110 / 2) * scaleX)
      .attr("y", globalY + ((2 * 30) / 3) * scaleY)
      .text(_s[_semester - 1])
      .attr("text-anchor", "middle")
      .attr("font-family", "sans-serif")
      .attr("font-weight", "bold")
      .attr("fill", "white");

    headerGroup.on(
      "click",
      (function (semKey) {
        return function () {
          toggleSemester(semKey);
        };
      })(semester)
    );

    _semester++;
    globalY += 40 * scaleY;

    // ramos del semestre
    for (let ramo in malla[semester]) {
      malla[semester][ramo].draw(drawer, globalX, globalY, scaleX, scaleY);
      globalY += 110 * scaleY;
    }

    globalX += 130 * scaleX;
  }

  drawer
    .selectAll(".ramo-label")
    .call(wrap, 115 * scaleX, (100 - (100 / 5) * 2) * scaleY);

  // ---- cargar ramos aprobados desde cache ----
  if (
    d3.select(".priori-canvas")._groups[0][0] == null &&
    d3.select(".custom-canvas")._groups[0][0] == null
  ) {
    var cache_variable = "approvedRamos_" + current_malla;
    if (cache_variable in localStorage && localStorage[cache_variable] !== "") {
      let approvedRamos = localStorage[cache_variable].split(",");
      approvedRamos.forEach(function (ramo) {
        if (all_ramos[ramo]) {
          all_ramos[ramo].approveRamo();
        }
      });
    }
  }

  // ---- verificar prerrequisitos + créditos ----
  d3.interval(function () {
    for (var semester in malla) {
      for (var ramo in malla[semester]) {
        malla[semester][ramo].verifyPrer();
      }
    }

    let current_credits = 0;
    let current_ramos = APPROVED.length;
    APPROVED.forEach(function (ramo) {
      current_credits += ramo.creditos;
    });
    d3
      .select(".info")
      .select("#creditos")
      .text(
        `${current_credits} (${parseInt(
          (current_credits / total_creditos) * 100
        )}%), Total ramos: ${parseInt((current_ramos * 100) / total_ramos)}%`
      );
  }, 30);

  // ---- guardar cache de aprobados ----
  d3.interval(function () {
    if (
      d3.select(".priori-canvas")._groups[0][0] == null &&
      d3.select(".custom-callas")._groups[0][0] == null
    ) {
      let willStore = [];
      APPROVED.forEach(function (ramo) {
        willStore.push(ramo.sigla);
      });
      localStorage["approvedRamos_" + current_malla] = willStore;
    }
  }, 2000);

  // ---- Pantalla de bienvenida ----
  var first_time = canvas.append("g");
  first_time
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "white")
    .attr("opacity", 0.9);

  first_time
    .append("text")
    .attr("x", width / 2)
    .attr("y", height / 2 - 180 * scaleY)
    .attr("dy", 0)
    .attr("text-anchor", "middle")
    .attr("font-size", 40 * scaleX)
    .attr("opacity", 0.01)
    .text(function () {
      if (d3.select(".custom-canvas")._groups[0][0]) return welcomeTitle;
      return welcomeTitle + carreras[current_malla];
    })
    .transition()
    .duration(800)
    .attr("y", height / 2)
    .attr("opacity", 1)
    .call(wrap, 900 * scaleX, height);

  first_time
    .append("text")
    .attr("x", width / 2)
    .attr("y", height / 2 - 90 * scaleY)
    .attr("dy", "2.1em")
    .attr("text-anchor", "middle")
    .attr("font-size", 30 * scaleX)
    .attr("opacity", 0.01)
    .text(welcomeDesc)
    .transition()
    .duration(800)
    .attr("y", height / 2)
    .attr("opacity", 1)
    .call(wrap, 900 * scaleX, height);

  first_time.on("click", function () {
    d3
      .select(this)
      .transition()
      .duration(200)
      .style("opacity", 0.1)
      .on("end", function () {
        d3.select(this).remove();
      });
  });

  if (d3.select(".priori-canvas")._groups[0][0]) {
    start_priorix();
  } else if (d3.select(".custom-canvas")._groups[0][0]) {
    start_generator();
  }
}

// ---------- wrap: encaja texto ----------
function wrap(text, width, height) {
  text.each(function () {
    var text = d3.select(this),
      words = text.text().split(/\s+/).reverse(),
      word,
      line = [],
      lineNumber = 0,
      lineHeight = 1.1,
      y = text.attr("y"),
      dy = parseFloat(text.attr("dy")),
      fontsize = parseInt(text.attr("font-size"), 10),
      tspan = text
        .text(null)
        .append("tspan")
        .attr("x", text.attr("x"))
        .attr("y", y)
        .attr("dy", dy + "em"),
      textLines,
      textHeight;
    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(" "));
      while (tspan.node().getComputedTextLength() > width) {
        if (line.length == 1) {
          text.attr("font-size", String(--fontsize));
        } else {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = text
            .append("tspan")
            .attr("x", text.attr("x"))
            .attr("y", y)
            .attr("dy", ++lineNumber * lineHeight + dy + "em")
            .text(word);
        }
      }
    }
    textLines = text.selectAll("tspan")._groups[0].length;
    if (textLines === 1) {
      text
        .selectAll("tspan")
        .attr("y", +d3.select(this).attr("y") + +5);
    } else if (textLines > 2) {
      text
        .selectAll("tspan")
        .attr("y", d3.select(this).attr("y") - ((110 / 2) * scaleY) / 4);
    }
    textHeight = text.node().getBoundingClientRect().height;

    while (textHeight > height - 5) {
      text.attr("font-size", String(--fontsize));
      textHeight = text.node().getBoundingClientRect().height;
      lineNumber = 0;
      let tspans = text.selectAll("tspan");
      for (let index = 0; index < textLines; index++) {
        let tspan = tspans._groups[0][index];
        tspan.setAttribute("dy", lineNumber++ * 1 + dy + "em");
      }
    }
  });
}

// Limpia todos los ramos aprobados
function limpiarRamos() {
  for (let i = APPROVED.length - 1; i >= 0; i--) {
    APPROVED[i].approveRamo();
  }
}

// Marca / desmarca todos los ramos de un semestre
function toggleSemester(semesterKey) {
  if (!malla[semesterKey]) return;

  let allApproved = true;
  for (let sigla in malla[semesterKey]) {
    if (!malla[semesterKey][sigla].isApproved()) {
      allApproved = false;
      break;
    }
  }

  for (let sigla in malla[semesterKey]) {
    const ramo = malla[semesterKey][sigla];
    if (allApproved) {
      if (ramo.isApproved()) ramo.approveRamo(); // desmarcar
    } else {
      if (!ramo.isApproved()) ramo.approveRamo(); // marcar
    }
  }
}

// Actualiza colores de un sector completo y los guarda
function updateSectorColor(sector, newColor, colorBySector, storageKey) {
  if (colorBySector && colorBySector[sector]) {
    colorBySector[sector][0] = newColor;
  }

  // Relleno de los ramos
  d3
    .selectAll("g[data-sector='" + sector + "'] rect.ramo-base")
    .attr("fill", newColor);

  // Círculos de prerrequisitos
  d3
    .selectAll("circle.prer-circle[data-sector='" + sector + "']")
    .attr("fill", newColor);

  // Circulito de la leyenda
  d3
    .selectAll(".color-item[data-sector='" + sector + "'] circle")
    .attr("fill", newColor);

  // Guardar en localStorage
  if (storageKey && colorBySector) {
    const toSave = {};
    Object.keys(colorBySector).forEach(function (k) {
      toSave[k] = colorBySector[k][0];
    });
    localStorage[storageKey] = JSON.stringify(toSave);
  }
}

// Restablecer colores por defecto
function resetColors(colorBySector, storageKey) {
  // 1. borrar colores personalizados
  localStorage.removeItem(storageKey);

  // 2. recargar JSON original
  d3.json("data/colors_" + current_malla + ".json", function (error, defaultColors) {
    if (error) {
      console.error("No se pudo cargar colores originales.", error);
      alert("No se pudieron restablecer los colores.");
      return;
    }

    Object.keys(defaultColors).forEach(function (k) {
      colorBySector[k][0] = defaultColors[k][0];
    });

    // 3. actualizar inputs
    d3.selectAll(".color-picker").each(function () {
      const sec = this.getAttribute("data-sector");
      this.value = colorBySector[sec][0];
    });

    // 4. actualizar colores de la malla
    Object.keys(colorBySector).forEach(function (sec) {
      updateSectorColor(sec, colorBySector[sec][0], colorBySector, storageKey);
    });
  });
}

// Exportar a PDF (ajustado para que no se corte)
function exportToPDF() {
  if (typeof html2canvas === "undefined") {
    alert("Error: html2canvas no está cargado.");
    return;
  }
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("Error: jsPDF no está cargado.");
    return;
  }

  const jsPDF = window.jspdf.jsPDF;
  const canvasContainer = document.querySelector(".canvas");
  if (!canvasContainer) {
    alert("No se encontró el contenedor .canvas");
    return;
  }

  html2canvas(canvasContainer).then(function (canvasEl) {
    const imgData = canvasEl.toDataURL("image/png");
    const pdf = new jsPDF("landscape", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;

    // espacio útil
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2 - 10; // 10 mm para título

    const imgOriginalWidth = canvasEl.width;
    const imgOriginalHeight = canvasEl.height;
    const imgRatio = imgOriginalWidth / imgOriginalHeight;

    let imgWidth = availableWidth;
    let imgHeight = imgWidth / imgRatio;

    if (imgHeight > availableHeight) {
      imgHeight = availableHeight;
      imgWidth = imgHeight * imgRatio;
    }

    const imgX = (pageWidth - imgWidth) / 2;
    const imgY = margin + 10; // debajo del título

    pdf.text("Avance de Malla - " + carreras[current_malla], margin, margin + 3);
    pdf.addImage(imgData, "PNG", imgX, imgY, imgWidth, imgHeight);

    const approvedCredits = APPROVED.reduce(function (acc, r) {
      return acc + r.creditos;
    }, 0);
    const creditText = "Créditos aprobados: " + approvedCredits;

    const creditsY = imgY + imgHeight + 8;
    if (creditsY <= pageHeight - margin) {
      pdf.text(creditText, margin, creditsY);
    } else {
      pdf.addPage();
      pdf.text(creditText, margin, margin + 10);
    }

    pdf.save("avance_malla_" + current_malla + ".pdf");
  }).catch(function (err) {
    console.error("Error al generar PDF:", err);
    alert("Ocurrió un error al generar el PDF (ver consola).");
  });
}

// ---- Modo oscuro ----
const darkToggle = document.getElementById("darkModeToggle");
if (darkToggle) {
  // cargar estado inicial
  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
    darkToggle.checked = true;
  }

  darkToggle.addEventListener("change", function () {
    if (this.checked) {
      document.body.classList.add("dark");
      localStorage.setItem("darkMode", "true");
    } else {
      document.body.classList.remove("dark");
      localStorage.setItem("darkMode", "false");
    }
  });
}
