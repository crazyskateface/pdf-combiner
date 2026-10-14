import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
import { PDFDocument } from "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const fileInput = document.querySelector("#file-input");
const addFilesInput = document.querySelector("#add-files-input");
const dropZone = document.querySelector("#drop-zone");
const editor = document.querySelector("#editor");
const pageGrid = document.querySelector("#page-grid");
const pageTemplate = document.querySelector("#page-template");
const pageCount = document.querySelector("#page-count");
const statusMessage = document.querySelector("#status-message");
const exportSummary = document.querySelector("#export-summary");
const combineButton = document.querySelector("#combine-button");
const clearButton = document.querySelector("#clear-button");
const viewer = document.querySelector("#viewer");
const viewerCanvas = document.querySelector("#viewer-canvas");
const viewerTitle = document.querySelector("#viewer-title");
const viewerPageLabel = document.querySelector("#viewer-page-label");
const closeViewerButton = document.querySelector("#close-viewer");
const previousPageButton = document.querySelector("#previous-page");
const nextPageButton = document.querySelector("#next-page");
const deleteViewerPageButton = document.querySelector("#delete-viewer-page");

let pages = [];
let viewerIndex = 0;
let nextPageId = 1;
let draggedCard = null;
let draggedPointerId = null;

function updateUi(message = "Ready to export.") {
  const count = pages.length;
  editor.hidden = count === 0;
  dropZone.hidden = count > 0;
  pageCount.hidden = count === 0;
  pageCount.textContent = `${count} page${count === 1 ? "" : "s"}`;
  statusMessage.textContent = message;
  exportSummary.textContent = `${count} page${count === 1 ? "" : "s"} selected`;
  combineButton.disabled = count === 0;
}

function clearWorkspace() {
  if (viewer.open) viewer.close();
  pages = [];
  pageGrid.replaceChildren();
  fileInput.value = "";
  addFilesInput.value = "";
  updateUi();
}

async function addFiles(files) {
  const pdfFiles = [...files].filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (!pdfFiles.length) {
    updateUi("Choose one or more PDF files.");
    return;
  }

  statusMessage.textContent = "Reading your PDFs…";
  for (const file of pdfFiles) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const previewDocument = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;

      for (let index = 1; index <= previewDocument.numPages; index += 1) {
        const page = await previewDocument.getPage(index);
        const item = { id: nextPageId++, bytes, sourceName: file.name, sourcePage: index };
        pages.push(item);
        await renderPageCard(item, pages.length, page);
      }
      previewDocument.destroy();
    } catch (error) {
      console.error(`Could not read ${file.name}`, error);
      statusMessage.textContent = `Could not read “${file.name}”. Please choose a valid PDF.`;
    }
  }

  updateUi(`${pages.length} page${pages.length === 1 ? "" : "s"} ready to combine.`);
}

async function renderPageCard(item, displayNumber, pdfPage) {
  const card = pageTemplate.content.firstElementChild.cloneNode(true);
  card.dataset.pageId = item.id;
  const canvas = card.querySelector("canvas");
  const pageNumber = card.querySelector(".page-number");
  const sourceName = card.querySelector(".source-name");
  const preview = card.querySelector(".page-preview");
  const viewButton = card.querySelector(".view-page");
  const deleteButton = card.querySelector(".remove-page");
  const viewport = pdfPage.getViewport({ scale: 0.55 });
  const scale = Math.min(2, window.devicePixelRatio || 1);

  canvas.width = Math.floor(viewport.width * scale);
  canvas.height = Math.floor(viewport.height * scale);
  await pdfPage.render({
    canvasContext: canvas.getContext("2d"),
    viewport,
    transform: scale === 1 ? null : [scale, 0, 0, scale, 0, 0],
  }).promise;

  pageNumber.textContent = `Page ${displayNumber}`;
  sourceName.textContent = item.sourceName;
  sourceName.title = item.sourceName;
  viewButton.addEventListener("click", () => openViewer(pages.indexOf(item)));
  deleteButton.addEventListener("click", () => removePage(item, card));
  preview.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    draggedCard = card;
    draggedPointerId = event.pointerId;
    card.classList.add("is-dragging");
    preview.setPointerCapture(event.pointerId);
  });
  preview.addEventListener("pointermove", (event) => {
    if (!draggedCard || event.pointerId !== draggedPointerId) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".page-card");
    if (!target || target === draggedCard) return;
    const bounds = target.getBoundingClientRect();
    const placeBefore = event.clientX < bounds.left + bounds.width / 2;
    pageGrid.insertBefore(draggedCard, placeBefore ? target : target.nextSibling);
  });
  preview.addEventListener("pointerup", finishPageDrag);
  preview.addEventListener("pointercancel", finishPageDrag);
  pageGrid.append(card);
}

function removePage(item, card) {
  const index = pages.indexOf(item);
  if (index === -1) return;

  pages.splice(index, 1);
  card.remove();
  refreshPageNumbers();
  updateUi(`${pages.length} page${pages.length === 1 ? "" : "s"} remaining.`);

  if (viewer.open) {
    if (!pages.length) {
      viewer.close();
    } else {
      openViewer(Math.min(index, pages.length - 1));
    }
  }
}

function finishPageDrag(event) {
  if (!draggedCard) return;
  if (event && event.pointerId !== draggedPointerId) return;
  draggedCard.classList.remove("is-dragging");
  pageGrid.querySelectorAll(".is-drop-target").forEach((card) => card.classList.remove("is-drop-target"));
  pages = [...pageGrid.children]
    .map((card) => pages.find((item) => item.id === Number(card.dataset.pageId)))
    .filter(Boolean);
  draggedCard = null;
  draggedPointerId = null;
  refreshPageNumbers();
  updateUi("Page order updated.");
}

function refreshPageNumbers() {
  [...pageGrid.children].forEach((pageCard, position) => {
    pageCard.querySelector(".page-number").textContent = `Page ${position + 1}`;
  });
}

async function openViewer(index) {
  if (index < 0 || index >= pages.length) return;

  viewerIndex = index;
  const item = pages[viewerIndex];
  viewerTitle.textContent = item.sourceName;
  viewerPageLabel.textContent = `Page ${viewerIndex + 1} of ${pages.length}`;
  previousPageButton.disabled = viewerIndex === 0;
  nextPageButton.disabled = viewerIndex === pages.length - 1;

  if (!viewer.open) viewer.showModal();

  const pdf = await pdfjsLib.getDocument({ data: item.bytes.slice() }).promise;
  const page = await pdf.getPage(item.sourcePage);
  const stage = viewerCanvas.parentElement;
  const unscaledViewport = page.getViewport({ scale: 1 });
  const availableWidth = stage.clientWidth - 50;
  const availableHeight = stage.clientHeight - 50;
  const scale = Math.max(0.5, Math.min(availableWidth / unscaledViewport.width, availableHeight / unscaledViewport.height));
  const viewport = page.getViewport({ scale });
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);

  viewerCanvas.width = Math.floor(viewport.width * pixelRatio);
  viewerCanvas.height = Math.floor(viewport.height * pixelRatio);
  viewerCanvas.style.width = `${Math.floor(viewport.width)}px`;
  viewerCanvas.style.height = `${Math.floor(viewport.height)}px`;
  await page.render({
    canvasContext: viewerCanvas.getContext("2d"),
    viewport,
    transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0],
  }).promise;
  pdf.destroy();
}

async function combineAndDownload() {
  if (!pages.length) return;

  combineButton.disabled = true;
  combineButton.textContent = "Saving…";
  statusMessage.textContent = "Saving your edited PDF…";

  try {
    const output = await PDFDocument.create();
    const loadedDocuments = new Map();

    for (const item of pages) {
      if (!loadedDocuments.has(item.bytes)) {
        loadedDocuments.set(item.bytes, await PDFDocument.load(item.bytes));
      }
      const source = loadedDocuments.get(item.bytes);
      const [copiedPage] = await output.copyPages(source, [item.sourcePage - 1]);
      output.addPage(copiedPage);
    }

    const blob = new Blob([await output.save()], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "edited-document.pdf";
    link.click();
    URL.revokeObjectURL(link.href);
    statusMessage.textContent = "Your edited PDF has downloaded.";
  } catch (error) {
    console.error("Could not combine PDFs", error);
    statusMessage.textContent = "Something went wrong while combining the PDFs.";
  } finally {
    combineButton.disabled = false;
    combineButton.textContent = "Save edited PDF";
  }
}

fileInput.addEventListener("change", (event) => addFiles(event.target.files));
addFilesInput.addEventListener("change", (event) => addFiles(event.target.files));
clearButton.addEventListener("click", clearWorkspace);
combineButton.addEventListener("click", combineAndDownload);
closeViewerButton.addEventListener("click", () => viewer.close());
previousPageButton.addEventListener("click", () => openViewer(viewerIndex - 1));
nextPageButton.addEventListener("click", () => openViewer(viewerIndex + 1));
deleteViewerPageButton.addEventListener("click", () => {
  const card = pageGrid.children[viewerIndex];
  removePage(pages[viewerIndex], card);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
});

dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
