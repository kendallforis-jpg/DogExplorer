
const API = "https://dog.ceo/api";
const $ = selector => document.querySelector(selector);

const state = {
  breeds: {},
  breedNames: [],
  gallery: [],
  favorites: loadFavorites(),
  selectedBreed: "",
  quiz: {
    answer: "",
    score: Number(localStorage.getItem("dogExplorerQuizScore") || 0),
    round: 1,
    answered: false
  },
  deferredInstallPrompt: null
};

function loadFavorites() {
  try {
    const value = JSON.parse(
      localStorage.getItem("dogExplorerFavorites") || "[]"
    );
    return Array.isArray(value)
      ? value.filter(item => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function saveFavorites() {
  localStorage.setItem(
    "dogExplorerFavorites",
    JSON.stringify(state.favorites)
  );
  $("#favoriteStat").textContent = state.favorites.length;
  $("#favoritesCount").textContent = `${state.favorites.length} saved`;
}

function titleCase(value) {
  return value
    .split(/[-\s]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function breedFromUrl(url) {
  const match = String(url).match(/\/breeds\/([^/]+)\//i);
  if (!match) return "Mystery pup";
  return titleCase(match[1].replace(/^([a-z]+)-([a-z]+)$/i, "$1 $2"));
}

function breedSlugFromUrl(url) {
  const match = String(url).match(/\/breeds\/([^/]+)\//i);
  return match ? match[1] : "";
}

async function api(path) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) {
    throw new Error(`Dog API returned ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== "success") {
    throw new Error(data.message || "The Dog API couldn't complete that request.");
  }

  return data.message;
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2500);
}

function loadingCard(message = "Fetching the goodest dogs…") {
  return `<div class="loading-card"><span class="loader"></span><p>${message}</p></div>`;
}

function safeImageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      parsed.hostname === "images.dog.ceo"
      ? parsed.href
      : "";
  } catch {
    return "";
  }
}

function dogCard(url, index = 0) {
  const safeUrl = safeImageUrl(url);
  if (!safeUrl) return "";

  const favorite = state.favorites.includes(safeUrl);
  const breed = breedFromUrl(safeUrl);

  return `<article class="dog-card">
    <img class="dog-card-image" src="${safeUrl}" alt="${breed} dog" loading="lazy" decoding="async">
    <div class="dog-card-body">
      <div>
        <div class="dog-card-name">${breed}</div>
        <div class="dog-card-subtitle">Good dog #${index + 1}</div>
      </div>
      <button class="card-heart ${favorite ? "is-favorite" : ""}"
        type="button" data-favorite="${safeUrl}"
        aria-label="${favorite ? "Remove from" : "Add to"} favorites"
        aria-pressed="${favorite}">${favorite ? "♥" : "♡"}</button>
    </div>
  </article>`;
}

function renderGallery() {
  $("#galleryGrid").innerHTML =
    state.gallery.map(dogCard).join("") ||
    `<div class="loading-card"><p>No photos to show yet. Try fetching more dogs.</p></div>`;

  $("#galleryMessage").textContent = "";
}

async function fetchGallery() {
  $("#refreshGalleryButton").disabled = true;
  $("#galleryGrid").innerHTML = loadingCard();
  $("#galleryMessage").textContent = "";

  try {
    const urls = await api("/breeds/image/random/12");
    state.gallery = [...new Set(urls.map(safeImageUrl).filter(Boolean))];
    renderGallery();
  } catch (error) {
    $("#galleryGrid").innerHTML =
      `<div class="loading-card"><p>We couldn't fetch dog photos. Check your connection and try again.</p></div>`;
    $("#galleryMessage").textContent = error.message;
  } finally {
    $("#refreshGalleryButton").disabled = false;
  }
}

async function fetchHero() {
  const image = $("#heroImage");

  try {
    const url = safeImageUrl(await api("/breeds/image/random"));
    if (!url) throw new Error("Invalid image URL");

    image.src = url;
    image.alt = `${breedFromUrl(url)} dog`;
    $("#heroBreed").textContent = breedFromUrl(url);
  } catch {
    $("#heroBreed").textContent = "Your next best friend";
    image.alt = "Dog photo unavailable while offline";
  }
}

function setView(view) {
  const ids = {
    random: "randomSection",
    breeds: "breedSection",
    favorites: "favoritesSection",
    quiz: "quizSection"
  };

  const target = ids[view];

  if (target) {
    document.getElementById(target).scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  if (view === "favorites") renderFavorites();

  if (view === "breeds") {
    $("#breedSearch").focus({ preventScroll: true });
  }
}

function renderBreedChips(filter = "") {
  const list = state.breedNames
    .filter(name => name.includes(filter.toLowerCase()))
    .slice(0, filter ? 36 : 12);

  $("#breedChips").innerHTML = list.map(name =>
    `<button class="breed-chip ${name === state.selectedBreed ? "active" : ""}"
      type="button" data-breed="${name}">${titleCase(name)}</button>`
  ).join("") || `<span class="section-subtitle">No breeds match that search.</span>`;
}

function chooseBreed(breed) {
  if (!state.breeds[breed]) return;

  state.selectedBreed = breed;
  $("#breedSelect").value = breed;
  $("#selectedBreedTitle").textContent = titleCase(breed);

  $("#selectedBreedText").textContent = state.breeds[breed].length
    ? `Explore ${titleCase(breed)} dogs, including ${state.breeds[breed].map(titleCase).join(", ")} varieties.`
    : `Meet the ${titleCase(breed)}. Fetch a fresh photo and see if this breed steals your heart.`;

  $("#breedPhotoButton").disabled = false;
  $("#breedImage").removeAttribute("src");
  $("#breedImage").hidden = true;
  $("#breedImagePlaceholder").hidden = false;

  $("#subBreedArea").hidden = !state.breeds[breed].length;
  $("#subBreedChips").innerHTML = state.breeds[breed].map(sub =>
    `<button class="breed-chip" type="button"
      data-subbreed="${sub}" data-parentbreed="${breed}">${titleCase(sub)}</button>`
  ).join("");

  renderBreedChips($("#breedSearch").value.trim());
}

async function loadBreeds() {
  try {
    state.breeds = await api("/breeds/list/all");
    state.breedNames = Object.keys(state.breeds).sort();

    $("#breedStat").textContent = state.breedNames.length;

    $("#breedSelect").innerHTML =
      `<option value="">Choose a breed…</option>` +
      state.breedNames.map(name =>
        `<option value="${name}">${titleCase(name)}</option>`
      ).join("");

    renderBreedChips();

    const preferred = state.breedNames.includes("corgi")
      ? "corgi"
      : state.breedNames[0];

    if (preferred) chooseBreed(preferred);
  } catch {
    $("#breedSelect").innerHTML =
      `<option value="">Breed list unavailable</option>`;

    $("#breedChips").innerHTML =
      `<span class="section-subtitle">The breed directory needs an internet connection. Try again in a moment.</span>`;
  }
}

async function showBreedPhoto(breed = state.selectedBreed, subBreed = "") {
  if (!breed) return;

  const button = $("#breedPhotoButton");
  button.disabled = true;
  button.textContent = "Finding a pup…";

  $("#breedImagePlaceholder").hidden = false;
  $("#breedImagePlaceholder").innerHTML =
    `<span class="loader"></span><span>Fetching a photo…</span>`;

  try {
    const path = subBreed
      ? `/breed/${encodeURIComponent(breed)}/${encodeURIComponent(subBreed)}/images/random`
      : `/breed/${encodeURIComponent(breed)}/images/random`;

    const url = safeImageUrl(await api(path));
    if (!url) throw new Error("Invalid image URL");

    const img = $("#breedImage");

    img.onload = () => {
      img.hidden = false;
      $("#breedImagePlaceholder").hidden = true;
    };

    img.onerror = () => {
      $("#breedImagePlaceholder").hidden = false;
      $("#breedImagePlaceholder").textContent = "Photo unavailable — try again";
    };

    img.src = url;
    img.alt = `${titleCase(subBreed ? `${breed} ${subBreed}` : breed)} dog`;

    $("#selectedBreedTitle").textContent =
      titleCase(subBreed ? `${breed} ${subBreed}` : breed);
  } catch {
    $("#breedImagePlaceholder").hidden = false;
    $("#breedImagePlaceholder").textContent =
      "Couldn't fetch a photo. Please try again.";
    toast("Couldn't fetch that breed photo.");
  } finally {
    button.disabled = false;
    button.textContent = "Show me this breed ↗";
  }
}

function renderFavorites() {
  const grid = $("#favoritesGrid");
  grid.innerHTML = state.favorites.map(dogCard).join("");
  $("#favoritesEmpty").hidden = state.favorites.length > 0;
  $("#favoritesCount").textContent = `${state.favorites.length} saved`;
}

function toggleFavorite(url) {
  const safeUrl = safeImageUrl(url);
  if (!safeUrl) return;

  if (state.favorites.includes(safeUrl)) {
    state.favorites = state.favorites.filter(item => item !== safeUrl);
    toast("Removed from your favorites");
  } else {
    state.favorites.unshift(safeUrl);
    state.favorites = [...new Set(state.favorites)].slice(0, 100);
    toast("A new favorite floof! 💗");
  }

  saveFavorites();
  renderGallery();
  renderFavorites();
}

function randomItems(items, count) {
  const pool = [...items];

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
}

async function nextQuiz() {
  const optionsNode = $("#quizOptions");
  $("#nextQuizButton").disabled = true;
  optionsNode.innerHTML = loadingCard("Finding your mystery pup…");

  $("#quizFeedback").className = "quiz-feedback";
  $("#quizFeedback").textContent = "Pick the breed you think matches the photo.";
  state.quiz.answered = false;

  try {
    const url = safeImageUrl(await api("/breeds/image/random"));
    const slug = breedSlugFromUrl(url);

    if (!url || !slug) throw new Error("No breed found");

    const mainBreed = state.breedNames.find(
      name => slug === name || slug.startsWith(`${name}-`)
    ) || slug.split("-")[0];

    state.quiz.answer = mainBreed;

    const wrong = randomItems(
      state.breedNames.filter(name => name !== mainBreed),
      3
    );

    const choices = randomItems([mainBreed, ...wrong], 4);
    const img = $("#quizImage");

    img.src = url;
    img.alt = "Guess the breed of this dog";
    img.hidden = false;
    $("#quizPlaceholder").hidden = true;
    $("#quizRound").textContent = state.quiz.round;

    optionsNode.innerHTML = choices.map(name =>
      `<button class="button button-outline" type="button"
        data-quiz-answer="${name}">${titleCase(name)}</button>`
    ).join("");
  } catch {
    optionsNode.innerHTML =
      `<p class="section-subtitle">Could not load a quiz photo. Check your connection and try again.</p>`;
    $("#quizFeedback").textContent =
      "The quiz needs an internet connection.";
  } finally {
    $("#nextQuizButton").disabled = false;
  }
}

function answerQuiz(choice, button) {
  if (state.quiz.answered) return;

  state.quiz.answered = true;
  const correct = choice === state.quiz.answer;

  if (correct) {
    state.quiz.score += 1;
    $("#quizFeedback").textContent =
      `That's right! It's a ${titleCase(state.quiz.answer)}! 🎉`;
    $("#quizFeedback").className = "quiz-feedback correct";
    button.classList.add("correct-answer");
    toast("Correct! Good eye! 🐾");
  } else {
    $("#quizFeedback").textContent =
      `Nice try! This one is a ${titleCase(state.quiz.answer)}.`;
    $("#quizFeedback").className = "quiz-feedback incorrect";
    button.classList.add("wrong-answer");

    document.querySelector(
      `[data-quiz-answer="${CSS.escape(state.quiz.answer)}"]`
    )?.classList.add("correct-answer");
  }

  state.quiz.round += 1;
  $("#quizScore").textContent = state.quiz.score;
  localStorage.setItem("dogExplorerQuizScore", String(state.quiz.score));

  $("#quizOptions").querySelectorAll("button").forEach(item => {
    item.disabled = true;
  });

  $("#nextQuizButton").textContent = "Next dog →";
}

function initInstallPrompt() {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    $("#installButton").hidden = false;
  });

  $("#installButton").addEventListener("click", async () => {
    if (!state.deferredInstallPrompt) {
      toast("Use your browser menu to install this app.");
      return;
    }

    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    $("#installButton").hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    $("#installButton").hidden = true;
    toast("Dog Explorer installed. Welcome in! 🐾");
  });
}

function bindEvents() {
  document.addEventListener("click", event => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) setView(viewButton.dataset.view);

    const favoriteButton = event.target.closest("[data-favorite]");
    if (favoriteButton) toggleFavorite(favoriteButton.dataset.favorite);

    const breedButton = event.target.closest("[data-breed]");
    if (breedButton) {
      chooseBreed(breedButton.dataset.breed);
      showBreedPhoto(breedButton.dataset.breed);
    }

    const subButton = event.target.closest("[data-subbreed]");
    if (subButton) {
      showBreedPhoto(subButton.dataset.parentbreed, subButton.dataset.subbreed);
    }

    const answerButton = event.target.closest("[data-quiz-answer]");
    if (answerButton) {
      answerQuiz(answerButton.dataset.quizAnswer, answerButton);
    }
  });

  $("#heroRandomButton").addEventListener("click", async () => {
    await fetchHero();
    setView("random");
    await fetchGallery();
  });

  $("#refreshGalleryButton").addEventListener("click", fetchGallery);

  $("#breedSearch").addEventListener("input", event => {
    const query = event.target.value.trim().toLowerCase();
    renderBreedChips(query);

    const match = state.breedNames.find(name => name.includes(query));
    if (match && query.length > 1) $("#breedSelect").value = match;
  });

  $("#breedSelect").addEventListener("change", event => {
    if (event.target.value) {
      chooseBreed(event.target.value);
      showBreedPhoto(event.target.value);
    }
  });

  $("#breedPhotoButton").addEventListener("click", () => showBreedPhoto());
  $("#nextQuizButton").addEventListener("click", nextQuiz);

  $("#backToTop").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.addEventListener("keydown", event => {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();
      setView("breeds");
      $("#breedSearch").focus();
    }
  });
}

async function init() {
  $("#favoriteStat").textContent = state.favorites.length;
  $("#quizScore").textContent = state.quiz.score;
  $("#favoritesCount").textContent = `${state.favorites.length} saved`;

  bindEvents();
  initInstallPrompt();
  renderFavorites();

  await Promise.all([
    loadBreeds(),
    fetchGallery(),
    fetchHero()
  ]);

  nextQuiz();
}

document.addEventListener("DOMContentLoaded", init);
