const STORAGE_KEY = "macro-meal-builder-state-v1";
const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const rawRestaurants = window.RESTAURANT_DATA || {};

const restaurants = Object.fromEntries(
  Object.entries(rawRestaurants).map(([restaurantId, restaurant]) => {
    const categories = restaurant.categories.map((category, categoryIndex) => ({
      ...category,
      order: categoryIndex,
      items: category.items.map((entry, itemIndex) => ({
        ...entry,
        id: `${restaurantId}-${category.id}-${itemIndex}`,
        restaurantId,
        categoryId: category.id,
        categoryTitle: category.title,
        max: entry.max ?? 4,
      })),
    }));

    return [
      restaurantId,
      {
        ...restaurant,
        categories,
        items: categories.flatMap((category) => category.items),
      },
    ];
  }),
);

const restaurantIds = Object.keys(restaurants);
const interactionState = {
  skipClickUntil: 0,
  skipClickTarget: null,
};

const elements = {
  restaurantCards: document.querySelector("#restaurantCards"),
  restaurantMeta: document.querySelector("#restaurantMeta"),
  categories: document.querySelector("#categories"),
  summary: document.querySelector("#summary"),
  mobileMacroBar: document.querySelector("#mobileMacroBar"),
};

const state = loadState();

elements.restaurantCards.addEventListener("click", onRestaurantCardClick);
elements.restaurantMeta.addEventListener("click", onMetaClick);
elements.categories.addEventListener("click", onCategoryClick);
elements.categories.addEventListener("pointerup", onCategoryPointerUp);
elements.summary.addEventListener("click", onSummaryClick);
elements.summary.addEventListener("pointerup", onSummaryPointerUp);
elements.mobileMacroBar.addEventListener("click", onMobileMacroBarClick);

render();

function loadState() {
  const fallback = {
    activeRestaurantId: restaurantIds[0],
    selectionsByRestaurant: Object.fromEntries(restaurantIds.map((id) => [id, {}])),
    openCategoriesByRestaurant: Object.fromEntries(
      restaurantIds.map((id) => [id, [restaurants[id].categories[0]?.id].filter(Boolean)]),
    ),
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");

    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }

    const activeRestaurantId = restaurantIds.includes(parsed.activeRestaurantId)
      ? parsed.activeRestaurantId
      : fallback.activeRestaurantId;

    const selectionsByRestaurant = Object.fromEntries(
      restaurantIds.map((restaurantId) => {
        const savedSelection = parsed.selectionsByRestaurant?.[restaurantId];
        return [restaurantId, sanitizeSelection(restaurantId, savedSelection)];
      }),
    );

    const openCategoriesByRestaurant = Object.fromEntries(
      restaurantIds.map((restaurantId) => {
        const savedOpen = parsed.openCategoriesByRestaurant?.[restaurantId];
        return [restaurantId, sanitizeOpenCategories(restaurantId, savedOpen)];
      }),
    );

    return {
      activeRestaurantId,
      selectionsByRestaurant,
      openCategoriesByRestaurant,
    };
  } catch (error) {
    return fallback;
  }
}

function sanitizeSelection(restaurantId, selection) {
  const validItems = new Map(
    restaurants[restaurantId].items.map((menuItem) => [menuItem.id, menuItem.max]),
  );

  if (!selection || typeof selection !== "object") {
    return {};
  }

  const cleaned = {};

  Object.entries(selection).forEach(([itemId, quantity]) => {
    if (!validItems.has(itemId)) {
      return;
    }

    const nextValue = Math.max(
      0,
      Math.min(Number(quantity) || 0, validItems.get(itemId)),
    );

    if (nextValue > 0) {
      cleaned[itemId] = nextValue;
    }
  });

  return cleaned;
}

function sanitizeOpenCategories(restaurantId, categories) {
  const validCategoryIds = new Set(restaurants[restaurantId].categories.map((category) => category.id));

  if (!Array.isArray(categories)) {
    return [restaurants[restaurantId].categories[0]?.id].filter(Boolean);
  }

  const cleaned = categories.filter((categoryId) => validCategoryIds.has(categoryId));

  return cleaned.length
    ? cleaned
    : [restaurants[restaurantId].categories[0]?.id].filter(Boolean);
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function onRestaurantCardClick(event) {
  const button = getClosestTarget(event.target, "[data-restaurant-id]");

  if (!button) {
    return;
  }

  state.activeRestaurantId = button.dataset.restaurantId;
  persistState();
  render();
}

function onMetaClick(event) {
  const resetButton = getClosestTarget(event.target, "[data-action='reset-meal']");

  if (!resetButton) {
    return;
  }

  resetActiveMeal();
}

function onCategoryClick(event) {
  if (shouldSkipSyntheticClick(event)) {
    return;
  }

  handleCategoryAction(event);
}

function onCategoryPointerUp(event) {
  if (event.pointerType === "") {
    return;
  }

  if (handleCategoryAction(event)) {
    registerPointerInteraction(event.target);
    event.preventDefault();
  }
}

function handleCategoryAction(event) {
  const toggleButton = getClosestTarget(
    event.target,
    "[data-action='toggle-category'][data-category-id]",
  );

  if (toggleButton) {
    toggleCategory(toggleButton.dataset.categoryId);
    return true;
  }

  const actionButton = getClosestTarget(event.target, "[data-action][data-item-id]");

  if (!actionButton) {
    return false;
  }

  const { action, itemId } = actionButton.dataset;

  updateQuantity(itemId, action === "increment" ? 1 : -1);
  return true;
}

function onSummaryClick(event) {
  if (shouldSkipSyntheticClick(event)) {
    return;
  }

  handleSummaryAction(event);
}

function onSummaryPointerUp(event) {
  if (event.pointerType === "") {
    return;
  }

  if (handleSummaryAction(event)) {
    registerPointerInteraction(event.target);
    event.preventDefault();
  }
}

function handleSummaryAction(event) {
  const removeButton = getClosestTarget(event.target, "[data-remove-item]");

  if (removeButton) {
    updateQuantity(removeButton.dataset.removeItem, -Infinity);
    return true;
  }

  const resetButton = getClosestTarget(event.target, "[data-action='reset-meal']");

  if (resetButton) {
    resetActiveMeal();
    return true;
  }

  return false;
}

function onMobileMacroBarClick(event) {
  const actionButton = getClosestTarget(event.target, "[data-action='scroll-summary']");

  if (!actionButton) {
    return;
  }

  elements.summary.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function resetActiveMeal() {
  state.selectionsByRestaurant[state.activeRestaurantId] = {};
  persistState();
  render();
}

function registerPointerInteraction(target) {
  interactionState.skipClickUntil = Date.now() + 500;
  interactionState.skipClickTarget = target;
}

function shouldSkipSyntheticClick(event) {
  const interactiveTarget = getClosestTarget(
    event.target,
    "[data-action], [data-remove-item], [data-restaurant-id]",
  );

  if (!interactiveTarget) {
    return false;
  }

  if (Date.now() > interactionState.skipClickUntil) {
    return false;
  }

  const previousTarget = interactionState.skipClickTarget;

  if (!previousTarget) {
    return false;
  }

  return (
    previousTarget === interactiveTarget ||
    previousTarget.contains(interactiveTarget) ||
    interactiveTarget.contains(previousTarget)
  );
}

function getClosestTarget(target, selector) {
  return target instanceof Element ? target.closest(selector) : null;
}

function toggleCategory(categoryId) {
  const openCategories = new Set(state.openCategoriesByRestaurant[state.activeRestaurantId] || []);

  if (openCategories.has(categoryId)) {
    openCategories.delete(categoryId);
  } else {
    openCategories.add(categoryId);
  }

  state.openCategoriesByRestaurant[state.activeRestaurantId] = [...openCategories];
  persistState();
  render();
}

function updateQuantity(itemId, delta) {
  const restaurant = getActiveRestaurant();
  const menuItem = restaurant.items.find((entry) => entry.id === itemId);

  if (!menuItem) {
    return;
  }

  const selection = state.selectionsByRestaurant[state.activeRestaurantId];
  const currentQuantity = selection[itemId] || 0;
  const nextQuantity =
    delta === -Infinity
      ? 0
      : Math.max(0, Math.min(currentQuantity + delta, menuItem.max));

  if (nextQuantity <= 0) {
    delete selection[itemId];
  } else {
    selection[itemId] = nextQuantity;
  }

  persistState();
  render();
}

function getActiveRestaurant() {
  return restaurants[state.activeRestaurantId];
}

function getActiveSelection() {
  return state.selectionsByRestaurant[state.activeRestaurantId];
}

function getOpenCategories() {
  return new Set(state.openCategoriesByRestaurant[state.activeRestaurantId] || []);
}

function getSelectedItems(restaurant = getActiveRestaurant()) {
  const selection = getActiveSelection();

  return restaurant.categories.flatMap((category) =>
    category.items
      .filter((menuItem) => selection[menuItem.id])
      .map((menuItem) => ({
        ...menuItem,
        quantity: selection[menuItem.id],
      })),
  );
}

function getTotals(selectedItems) {
  return selectedItems.reduce(
    (totals, menuItem) => ({
      calories: totals.calories + menuItem.calories * menuItem.quantity,
      protein: totals.protein + menuItem.protein * menuItem.quantity,
      carbs: totals.carbs + menuItem.carbs * menuItem.quantity,
      fat: totals.fat + menuItem.fat * menuItem.quantity,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function getMacroSplit(totals) {
  const proteinCalories = totals.protein * 4;
  const carbCalories = totals.carbs * 4;
  const fatCalories = totals.fat * 9;
  const totalMacroCalories = proteinCalories + carbCalories + fatCalories;

  if (!totalMacroCalories) {
    return {
      protein: 0,
      carbs: 0,
      fat: 0,
    };
  }

  return {
    protein: (proteinCalories / totalMacroCalories) * 100,
    carbs: (carbCalories / totalMacroCalories) * 100,
    fat: (fatCalories / totalMacroCalories) * 100,
  };
}

function getInsight(totals, selectionCount) {
  if (!selectionCount) {
    return "Add ingredients with the plus buttons and the macro summary will update instantly.";
  }

  if (totals.protein >= 45 && totals.fat <= 25) {
    return "This build is leaning high-protein and fairly lean.";
  }

  if (totals.protein >= 40) {
    return "This is a protein-forward meal with solid recovery potential.";
  }

  if (totals.carbs >= 85 && totals.carbs > totals.protein) {
    return "This build is carb-heavy, which can be great around training or long days.";
  }

  if (totals.fat >= 35 && totals.fat > totals.carbs / 2) {
    return "This one is richer and more fat-forward than a typical lighter build.";
  }

  return "This looks like a balanced custom meal with room to tune either way.";
}

function applyTheme(restaurant) {
  document.documentElement.style.setProperty("--brand", restaurant.theme.brand);
  document.documentElement.style.setProperty("--accent", restaurant.theme.accent);
  document.documentElement.style.setProperty("--wash", restaurant.theme.wash);
  document.documentElement.style.setProperty("--glow", restaurant.theme.glow);
}

function render() {
  const restaurant = getActiveRestaurant();
  const selectedItems = getSelectedItems(restaurant);
  const totals = getTotals(selectedItems);
  const totalSelections = selectedItems.reduce(
    (sum, menuItem) => sum + menuItem.quantity,
    0,
  );

  applyTheme(restaurant);
  renderRestaurantCards(restaurant);
  renderRestaurantMeta(restaurant, selectedItems, totalSelections);
  renderCategories(restaurant);
  renderSummary(restaurant, selectedItems, totals, totalSelections);
  renderMobileMacroBar(selectedItems, totals, totalSelections);
}

function renderRestaurantCards(activeRestaurant) {
  elements.restaurantCards.innerHTML = restaurantIds
    .map((restaurantId) => {
      const restaurant = restaurants[restaurantId];
      const ingredientCount = restaurant.items.length;
      const isActive = restaurantId === activeRestaurant.id;

      return `
        <button
          class="restaurant-card ${isActive ? "is-active" : ""}"
          type="button"
          data-restaurant-id="${restaurant.id}"
          style="--card-brand:${restaurant.theme.brand}; --card-accent:${restaurant.theme.accent}; --card-wash:${restaurant.theme.wash};"
          aria-pressed="${isActive ? "true" : "false"}"
        >
          <span class="restaurant-card__kicker">${restaurant.kicker}</span>
          <span class="restaurant-card__title">${restaurant.name}</span>
          <p class="restaurant-card__body">${restaurant.description}</p>
          <div class="restaurant-card__meta">
            <span class="metric-pill">${restaurant.categories.length} lanes</span>
            <span class="metric-pill">${ingredientCount} ingredients</span>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderRestaurantMeta(restaurant, selectedItems, totalSelections) {
  const uniqueSelectionCount = selectedItems.length;

  elements.restaurantMeta.innerHTML = `
    <section class="restaurant-intro">
      <div class="restaurant-intro__top">
        <div>
          <p class="eyebrow">Step 2</p>
          <h2>${restaurant.name} builder</h2>
          <p class="restaurant-intro__body">${restaurant.note}</p>
        </div>
        <div class="restaurant-intro__source">
          <span class="source-pill">Official source</span>
          <p class="restaurant-intro__note">
            <a href="${restaurant.source.url}" target="_blank" rel="noreferrer">${restaurant.source.label}</a><br />
            ${restaurant.source.updated}
          </p>
        </div>
      </div>

      <div class="tip-row">
        ${restaurant.tips
          .map((tip) => `<span class="tip-pill">${tip}</span>`)
          .join("")}
      </div>

      <div class="restaurant-actions">
        <div class="tip-row">
          <span class="selection-pill">${uniqueSelectionCount} unique items</span>
          <span class="selection-pill">${totalSelections} total servings</span>
        </div>
        <button class="button-reset" type="button" data-action="reset-meal">Reset meal</button>
      </div>
    </section>
  `;
}

function renderCategories(restaurant) {
  const selection = getActiveSelection();
  const openCategories = getOpenCategories();

  elements.categories.innerHTML = restaurant.categories
    .map((category) => {
      const categorySelectionCount = category.items.reduce(
        (sum, menuItem) => sum + (selection[menuItem.id] || 0),
        0,
      );
      const isOpen = openCategories.has(category.id);

      return `
        <section class="category-panel ${isOpen ? "is-open" : "is-collapsed"}">
          <button
            class="category-header"
            type="button"
            data-action="toggle-category"
            data-category-id="${category.id}"
            aria-expanded="${isOpen ? "true" : "false"}"
          >
            <div class="category-header__copy">
              <p class="eyebrow">${category.title}</p>
              <h3>${category.title}</h3>
              <p>${category.description}</p>
            </div>
            <div class="category-header__side">
              <span class="count-pill">${categorySelectionCount} selected</span>
              <span class="category-chevron" aria-hidden="true">${isOpen ? "-" : "+"}</span>
            </div>
          </button>

          <div class="category-body" ${isOpen ? "" : "hidden"}>
            <div class="ingredient-grid">
              ${category.items
                .map((menuItem) => renderIngredientCard(menuItem, selection[menuItem.id] || 0))
                .join("")}
            </div>
          </div>
        </section>
      `;
    })
    .join("");
}

function renderIngredientCard(menuItem, quantity) {
  return `
    <article class="ingredient-card ${quantity ? "is-selected" : ""}">
      <div class="ingredient-card__head">
        <div>
          <h4>${menuItem.name}</h4>
          <p class="ingredient-card__serving">${menuItem.serving}</p>
        </div>
        <span class="count-pill">${quantity ? `x${quantity}` : "Ready"}</span>
      </div>

      ${
        menuItem.note
          ? `<p class="ingredient-card__note">${menuItem.note}</p>`
          : ""
      }

      <div class="ingredient-card__macros">
        <span>${formatNumber(menuItem.calories)} cal</span>
        <span>P ${formatNumber(menuItem.protein)}</span>
        <span>C ${formatNumber(menuItem.carbs)}</span>
        <span>F ${formatNumber(menuItem.fat)}</span>
      </div>

      <div class="stepper">
        <button
          type="button"
          data-action="decrement"
          data-item-id="${menuItem.id}"
          ${quantity === 0 ? "disabled" : ""}
          aria-label="Decrease ${menuItem.name}"
        >
          -
        </button>
        <span class="stepper__value">${quantity}</span>
        <button
          type="button"
          data-action="increment"
          data-item-id="${menuItem.id}"
          ${quantity >= menuItem.max ? "disabled" : ""}
          aria-label="Increase ${menuItem.name}"
        >
          +
        </button>
      </div>
    </article>
  `;
}

function renderSummary(restaurant, selectedItems, totals, totalSelections) {
  const split = getMacroSplit(totals);
  const insight = getInsight(totals, selectedItems.length);

  elements.summary.innerHTML = `
    <section class="summary-card">
      <div>
        <p class="eyebrow">Step 3</p>
        <h3>Live macro totals</h3>
        <p class="summary-card__description">${insight}</p>
      </div>

      <div class="macro-grid">
        ${renderMacroCard("Calories", `${formatNumber(totals.calories)}`, "kcal")}
        ${renderMacroCard("Protein", `${formatNumber(totals.protein)}`, "grams")}
        ${renderMacroCard("Carbs", `${formatNumber(totals.carbs)}`, "grams")}
        ${renderMacroCard("Fat", `${formatNumber(totals.fat)}`, "grams")}
      </div>

      <div class="macro-split">
        <div class="macro-split__bar" aria-hidden="true">
          <span class="macro-split__segment macro-split__segment--protein" style="width:${split.protein}%;"></span>
          <span class="macro-split__segment macro-split__segment--carbs" style="width:${split.carbs}%;"></span>
          <span class="macro-split__segment macro-split__segment--fat" style="width:${split.fat}%;"></span>
        </div>
        <div class="macro-legend">
          <div class="macro-legend__row">
            <span class="macro-legend__label"><span class="macro-dot macro-dot--protein"></span>Protein calories</span>
            <strong>${formatNumber(split.protein)}%</strong>
          </div>
          <div class="macro-legend__row">
            <span class="macro-legend__label"><span class="macro-dot macro-dot--carbs"></span>Carb calories</span>
            <strong>${formatNumber(split.carbs)}%</strong>
          </div>
          <div class="macro-legend__row">
            <span class="macro-legend__label"><span class="macro-dot macro-dot--fat"></span>Fat calories</span>
            <strong>${formatNumber(split.fat)}%</strong>
          </div>
        </div>
      </div>

      <div class="summary-meta">
        <span class="selection-pill">${selectedItems.length} unique items</span>
        <span class="selection-pill">${totalSelections} servings counted</span>
      </div>

      <div class="selected-list">
        ${
          selectedItems.length
            ? selectedItems.map(renderSelectedItem).join("")
            : `<div class="empty-state">Pick a restaurant, tap the plus buttons on the ingredients you want, and this panel will total everything for you in real time.</div>`
        }
      </div>

      <button class="button-reset" type="button" data-action="reset-meal">Reset meal</button>

      <p class="summary-card__footnote">
        Macro data is sourced from
        <a href="${restaurant.source.url}" target="_blank" rel="noreferrer">${restaurant.source.label}</a>.
        Availability and portions can vary by location.
      </p>
    </section>
  `;
}

function renderMobileMacroBar(selectedItems, totals, totalSelections) {
  const title = totalSelections
    ? `${totalSelections} servings`
    : "Ready to build";
  const buttonLabel = selectedItems.length ? "Summary" : "Details";

  elements.mobileMacroBar.innerHTML = `
    <section class="mobile-macro-bar__surface">
      <div class="mobile-macro-bar__top">
        <div>
          <span class="mobile-macro-bar__label">Live macros</span>
          <strong class="mobile-macro-bar__title">${title}</strong>
        </div>
        <button
          class="mobile-macro-bar__button"
          type="button"
          data-action="scroll-summary"
          aria-label="Jump to full meal summary"
        >
          ${buttonLabel}
        </button>
      </div>

      <div class="mobile-macro-bar__stats">
        ${renderMobileMacroItem("Cal", `${formatNumber(totals.calories)}`)}
        ${renderMobileMacroItem("P", `${formatNumber(totals.protein)}g`)}
        ${renderMobileMacroItem("C", `${formatNumber(totals.carbs)}g`)}
        ${renderMobileMacroItem("F", `${formatNumber(totals.fat)}g`)}
      </div>
    </section>
  `;
}

function renderMacroCard(label, value, unit) {
  return `
    <article class="macro-card">
      <span class="macro-card__value">${value}</span>
      <span class="macro-card__label">${label} &middot; ${unit}</span>
    </article>
  `;
}

function renderMobileMacroItem(label, value) {
  return `
    <article class="mobile-macro-pill">
      <span class="mobile-macro-pill__value">${value}</span>
      <span class="mobile-macro-pill__label">${label}</span>
    </article>
  `;
}

function renderSelectedItem(menuItem) {
  const totalCalories = menuItem.quantity * menuItem.calories;

  return `
    <article class="selected-item">
      <div>
        <p class="selected-item__title">${menuItem.quantity}x ${menuItem.name}</p>
        <p class="selected-item__meta">${menuItem.categoryTitle} &middot; ${menuItem.serving}</p>
      </div>
      <div class="selected-item__side">
        <span class="selected-item__calories">${formatNumber(totalCalories)} cal</span>
        <button class="button-remove" type="button" data-remove-item="${menuItem.id}">Remove</button>
      </div>
    </article>
  `;
}

function formatNumber(value) {
  return numberFormatter.format(Math.round(value * 10) / 10);
}
