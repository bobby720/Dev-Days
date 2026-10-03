"use strict";

const STORAGE_KEY = "it_support_tickets";
const STATUSES = ["Open", "In Progress", "Resolved"];
const CATEGORIES = ["Hardware", "Software", "Network", "Account access", "Other"];
const PRIORITIES = ["Low", "Medium", "High"];
const LIMITS = { title: 120, requester: 80, description: 2000 };

const form = document.querySelector("#ticket-form");
const titleInput = document.querySelector("#title");
const requesterInput = document.querySelector("#requester");
const descriptionInput = document.querySelector("#description");
const categoryInput = document.querySelector("#category");
const priorityInput = document.querySelector("#priority");
const formFeedback = document.querySelector("#form-feedback");
const storageNotice = document.querySelector("#storage-notice");
const searchInput = document.querySelector("#ticket-search");
const statusFilter = document.querySelector("#status-filter");
const categoryFilter = document.querySelector("#category-filter");
const clearFiltersButton = document.querySelector("#clear-filters");
const ticketList = document.querySelector("#ticket-list");
const emptyState = document.querySelector("#empty-state");
const emptyTitle = document.querySelector("#empty-title");
const emptyCopy = document.querySelector("#empty-copy");
const visibleCount = document.querySelector("#visible-count");
const queueTitle = document.querySelector("#queue-title");

let tickets = loadTickets();
let pendingDeleteId = null;

function makeUniqueId() {
  const existingIds = new Set(tickets.map((ticket) => ticket.id));
  let baseId;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    baseId = crypto.randomUUID();
  } else {
    baseId = Date.now().toString();
  }
  let id = baseId;
  let suffix = 1;
  while (existingIds.has(id)) id = `${baseId}-${suffix++}`;
  return id;
}

function asText(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nonWhitespaceLength(value) {
  return [...value].filter((character) => !/\s/u.test(character)).length;
}

function normalizeTicket(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const id = asText(record.id).trim();
  const title = asText(record.title).trim();
  if (!id || nonWhitespaceLength(title) < 3 || !STATUSES.includes(record.status)) return null;
  const createdAt = asText(record.createdAt);
  return {
    id,
    title,
    requester: asText(record.requester).trim(),
    category: CATEGORIES.includes(record.category) ? record.category : "Other",
    priority: PRIORITIES.includes(record.priority) ? record.priority : "Medium",
    description: asText(record.description).trim(),
    status: record.status,
    createdAt: createdAt && !Number.isNaN(Date.parse(createdAt)) ? createdAt : new Date().toISOString()
  };
}

function loadTickets() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    const validTickets = [];
    const seenIds = new Set();
    for (const entry of parsed) {
      const ticket = normalizeTicket(entry);
      if (!ticket || seenIds.has(ticket.id)) continue;
      seenIds.add(ticket.id);
      validTickets.push(ticket);
    }
    return validTickets;
  } catch {
    return [];
  }
}

function persistTickets() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
    storageNotice.textContent = "";
    return true;
  } catch {
    storageNotice.textContent = "Changes are visible for this session, but browser storage is unavailable. They may not be saved after you leave.";
    return false;
  }
}

function setFieldError(input, message) {
  const error = document.querySelector(`#${input.id}-error`);
  error.textContent = message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function validateRequiredText(input, label, maxLength) {
  const value = input.value.trim();
  let message = "";
  if (!value) {
    message = `Enter a ${label}.`;
  } else if (nonWhitespaceLength(value) < 3) {
    message = `${label[0].toUpperCase()}${label.slice(1)} must contain at least 3 non-whitespace characters.`;
  } else if (value.length > maxLength) {
    message = `${label[0].toUpperCase()}${label.slice(1)} must be ${maxLength} characters or fewer.`;
  }
  setFieldError(input, message);
  return { value, valid: !message };
}

function clearFieldErrors() {
  setFieldError(titleInput, "");
  setFieldError(requesterInput, "");
  setFieldError(descriptionInput, "");
  formFeedback.textContent = "";
  formFeedback.classList.remove("is-error");
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return "Date unavailable";
  }
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createBadge(text, className) {
  return createElement("span", `badge ${className}`, text);
}

function makeStatusSelect(ticket) {
  const label = createElement("label", "status-control", "Update status");
  const select = document.createElement("select");
  select.setAttribute("aria-label", `Update status for ${ticket.title}`);
  for (const status of STATUSES) {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    option.selected = status === ticket.status;
    select.append(option);
  }
  select.addEventListener("change", () => {
    const current = tickets.find((item) => item.id === ticket.id);
    if (!current) return;
    current.status = select.value;
    persistTickets();
    render();
  });
  label.append(select);
  return label;
}

function renderTicket(ticket) {
  const card = createElement("article", "ticket-card");
  const topLine = createElement("div", "ticket-topline");
  const headingWrap = createElement("div", "ticket-heading-wrap");
  const title = createElement("h3", "ticket-title", ticket.title || "Untitled request");
  const meta = createElement("div", "ticket-meta");
  const requester = createElement("span", "", `Requested by ${ticket.requester || "Unknown requester"}`);
  const category = createElement("span", "", ticket.category);
  const date = document.createElement("time");
  date.dateTime = ticket.createdAt;
  date.textContent = formatDate(ticket.createdAt);
  meta.append(requester, category, date);
  headingWrap.append(title, meta);

  const badges = createElement("div", "ticket-badges");
  const priorityClass = `priority-${ticket.priority.toLowerCase()}`;
  const priorityText = `${ticket.priority} Priority`;
  const priorityBadge = createBadge(priorityText, priorityClass);
  priorityBadge.setAttribute("aria-label", priorityText);
  badges.append(priorityBadge);
  const statusClass = `status-${ticket.status.toLowerCase().replaceAll(" ", "-")}`;
  badges.append(createBadge(ticket.status, statusClass));
  topLine.append(headingWrap, badges);
  card.append(topLine);

  if (ticket.description) {
    card.append(createElement("p", "ticket-description", ticket.description));
  }

  const actions = createElement("div", "ticket-actions");
  actions.append(makeStatusSelect(ticket));
  if (pendingDeleteId === ticket.id) {
    const confirmation = createElement("div", "delete-confirmation");
    confirmation.setAttribute("role", "group");
    confirmation.setAttribute("aria-label", `Confirm deletion of ${ticket.title}`);
    confirmation.append(createElement("p", "", `Delete “${ticket.title}”?`));
    const confirmButton = createElement("button", "button button-danger", "Confirm delete");
    confirmButton.type = "button";
    confirmButton.addEventListener("click", () => {
      tickets = tickets.filter((item) => item.id !== ticket.id);
      pendingDeleteId = null;
      persistTickets();
      render();
      queueTitle.focus();
    });
    const cancelButton = createElement("button", "button button-secondary", "Cancel");
    cancelButton.type = "button";
    cancelButton.addEventListener("click", () => {
      pendingDeleteId = null;
      render();
      for (const button of ticketList.querySelectorAll(".delete-button")) {
        if (button.dataset.ticketId === ticket.id) button.focus();
      }
    });
    confirmation.append(confirmButton, cancelButton);
    actions.append(confirmation);
  } else {
    const deleteButton = createElement("button", "delete-button", "Delete ticket");
    deleteButton.type = "button";
    deleteButton.dataset.ticketId = ticket.id;
    deleteButton.setAttribute("aria-label", `Delete ticket: ${ticket.title}`);
    deleteButton.addEventListener("click", () => {
      pendingDeleteId = ticket.id;
      render();
      const nextConfirm = ticketList.querySelector(".button-danger");
      if (nextConfirm) nextConfirm.focus();
    });
    actions.append(deleteButton);
  }
  card.append(actions);
  return card;
}

function updateMetrics() {
  document.querySelector("#total-count").textContent = String(tickets.length);
  document.querySelector("#open-count").textContent = String(tickets.filter((ticket) => ticket.status === "Open").length);
  document.querySelector("#progress-count").textContent = String(tickets.filter((ticket) => ticket.status === "In Progress").length);
  document.querySelector("#resolved-count").textContent = String(tickets.filter((ticket) => ticket.status === "Resolved").length);
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;
  const selectedCategory = categoryFilter.value;
  const matches = tickets.filter((ticket) => {
    const matchesText = !query || ticket.title.toLowerCase().includes(query) || ticket.requester.toLowerCase().includes(query);
    const matchesStatus = selectedStatus === "All" || ticket.status === selectedStatus;
    const matchesCategory = selectedCategory === "All" || ticket.category === selectedCategory;
    return matchesText && matchesStatus && matchesCategory;
  });

  const fragment = document.createDocumentFragment();
  for (const ticket of matches) fragment.append(renderTicket(ticket));
  ticketList.replaceChildren(fragment);
  updateMetrics();
  visibleCount.textContent = `${matches.length} ${matches.length === 1 ? "ticket" : "tickets"}`;
  emptyState.hidden = matches.length > 0;
  if (tickets.length === 0) {
    emptyTitle.textContent = "No tickets exist yet—create your first one";
    emptyCopy.textContent = "New requests will appear here once submitted.";
    clearFiltersButton.hidden = true;
  } else {
    emptyTitle.textContent = "No tickets match your search filters—try resetting filters";
    emptyCopy.textContent = "Clear the current filters to see the full queue.";
    clearFiltersButton.hidden = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFieldErrors();
  const titleResult = validateRequiredText(titleInput, "issue summary", LIMITS.title);
  const requesterResult = validateRequiredText(requesterInput, "requester name", LIMITS.requester);
  const description = descriptionInput.value.trim();
  if (description.length > LIMITS.description) {
    setFieldError(descriptionInput, `Description must be ${LIMITS.description} characters or fewer.`);
  }
  if (!titleResult.valid || !requesterResult.valid || description.length > LIMITS.description) {
    const firstInvalid = !titleResult.valid ? titleInput : !requesterResult.valid ? requesterInput : descriptionInput;
    firstInvalid.focus();
    return;
  }

  tickets.unshift({
    id: makeUniqueId(),
    title: titleResult.value,
    requester: requesterResult.value,
    category: CATEGORIES.includes(categoryInput.value) ? categoryInput.value : "Other",
    priority: PRIORITIES.includes(priorityInput.value) ? priorityInput.value : "Medium",
    description,
    status: "Open",
    createdAt: new Date().toISOString()
  });
  const saved = persistTickets();
  form.reset();
  priorityInput.value = "Medium";
  formFeedback.textContent = saved ? "Ticket created." : "Ticket created for this session.";
  render();
  titleInput.focus();
});

titleInput.addEventListener("input", () => {
  if (titleInput.getAttribute("aria-invalid") === "true") validateRequiredText(titleInput, "issue summary", LIMITS.title);
});
requesterInput.addEventListener("input", () => {
  if (requesterInput.getAttribute("aria-invalid") === "true") validateRequiredText(requesterInput, "requester name", LIMITS.requester);
});
descriptionInput.addEventListener("input", () => {
  if (descriptionInput.getAttribute("aria-invalid") === "true") {
    const length = descriptionInput.value.trim().length;
    setFieldError(descriptionInput, length > LIMITS.description ? `Description must be ${LIMITS.description} characters or fewer.` : "");
  }
});
searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);
categoryFilter.addEventListener("change", render);
clearFiltersButton.addEventListener("click", () => {
  searchInput.value = "";
  statusFilter.value = "All";
  categoryFilter.value = "All";
  render();
  searchInput.focus();
});

render();
