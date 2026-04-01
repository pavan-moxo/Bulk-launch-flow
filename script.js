// Application State
const AppState = {
  currentStep: 1,
  webhookConfig: {
    url: "",
  },
  jsonTemplate: null,
  jsonFields: [],
  requiredFields: ["workspace_name", "workspace_owner"],
  csvData: [],
  csvHeaders: [],
  mappings: {},
  workspaceNameTemplate: [],
  workspaceNameSeparator: " - ",
  processing: false,
  results: [],
  stats: { total: 0, success: 0, failed: 0 },
  autoMapEnabled: true,
};

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  setupEventListeners();
});

function setupEventListeners() {
  document
    .getElementById("nameSeparator")
    .addEventListener("input", function () {
      AppState.workspaceNameSeparator = this.value;
      updateWorkspaceNamePreview();
    });

  document
    .getElementById("jsonFile")
    .addEventListener("change", handleJsonUpload);

  const jsonUploadArea = document.getElementById("jsonUploadArea");
  jsonUploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    jsonUploadArea.classList.add("dragover");
  });
  jsonUploadArea.addEventListener("dragleave", () => {
    jsonUploadArea.classList.remove("dragover");
  });
  jsonUploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    jsonUploadArea.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".json")) {
      document.getElementById("jsonFile").files = e.dataTransfer.files;
      handleJsonUpload({ target: document.getElementById("jsonFile") });
    }
  });

  document
    .getElementById("csvFile")
    .addEventListener("change", handleCsvUpload);

  const csvUploadArea = document.getElementById("csvUploadArea");
  csvUploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    csvUploadArea.classList.add("dragover");
  });
  csvUploadArea.addEventListener("dragleave", () => {
    csvUploadArea.classList.remove("dragover");
  });
  csvUploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    csvUploadArea.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      document.getElementById("csvFile").files = e.dataTransfer.files;
      handleCsvUpload({ target: document.getElementById("csvFile") });
    }
  });

  document.getElementById("autoMapToggle")?.addEventListener("change", function(e) {
    AppState.autoMapEnabled = this.checked;
    const warning = document.getElementById("autoMapWarning");
    if (warning) {
      warning.style.display = this.checked ? "block" : "none";
    }
  });
}

function goToStep(step) {
  AppState.currentStep = step;

  document.querySelectorAll(".step").forEach((s, i) => {
    s.classList.remove("active");
    if (i + 1 === step) s.classList.add("active");
  });

  document.querySelectorAll('.card[id^="step"]').forEach((el, i) => {
    el.style.display = i + 1 === step ? "block" : "none";
  });

  if (
    step === 4 &&
    AppState.csvHeaders.length > 0 &&
    AppState.jsonFields.length > 0
  ) {
    const autoMapToggle = document.getElementById("autoMapToggle");
    if (autoMapToggle && !autoMapToggle.checked) {
      console.log("Auto-mapping is OFF - clearing previous mappings");
      AppState.jsonFields.forEach(field => {
        const workspaceNameBuilder = document.getElementById("workspaceNameBuilder");
        if (!(field === "workspace_name" && workspaceNameBuilder && workspaceNameBuilder.style.display === "block")) {
          AppState.mappings[field] = "";
        }
      });
    }
    setupMappingUI();
  }
  if (step === 5) {
    showReview();
  }
  if (step === 6) {
    resetLaunchState();
  }
}

function validateStep1() {
  const url = document.getElementById("webhookUrl").value.trim();
  if (!url) {
    showNotification("Please enter webhook URL", "error");
    return;
  }

  AppState.webhookConfig.url = url;
  goToStep(2);
}

function handleJsonUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const jsonData = JSON.parse(e.target.result);
      AppState.jsonTemplate = jsonData;

      AppState.jsonFields = extractJsonFields(jsonData);

      AppState.jsonFields.forEach((field) => {
        if (!AppState.mappings[field]) {
          AppState.mappings[field] = "";
        }
      });

      showJsonPreview();
      document.getElementById("nextStep2").disabled = false;
      document.getElementById("downloadSampleCsvBtn").style.display = "block";
      showNotification("JSON template loaded successfully!", "success");
    } catch (error) {
      showNotification("Error parsing JSON: " + error.message, "error");
    }
  };
  reader.readAsText(file);
}

function downloadSampleCSV() {
  if (!AppState.jsonFields || AppState.jsonFields.length === 0) {
    showNotification("Please upload JSON template first", "error");
    return;
  }

  const headers = AppState.jsonFields.map((field) => {
    const fieldName = field.replace(/\./g, "_");
    return `"${fieldName}"`;
  });

  const csvContent = headers.join(",") + "\n";
  
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "moxo-csv-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showNotification("CSV template with headers downloaded!", "success");
}

function extractJsonFields(obj, prefix = "") {
  const fields = [];
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (
        typeof obj[key] === "object" &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        fields.push(...extractJsonFields(obj[key], fullKey));
      } else {
        fields.push(fullKey);
      }
    }
  }
  return fields;
}

function showJsonPreview() {
  const container = document.getElementById("jsonPreview");
  const fieldCount = AppState.jsonFields.length;

  document.getElementById("jsonFieldCount").textContent =
    `${fieldCount} fields`;

  const fieldsList =
    AppState.jsonFields.slice(0, 10).join(", ") +
    (fieldCount > 10 ? ` ... and ${fieldCount - 10} more` : "");
  document.getElementById("jsonFieldsList").textContent = fieldsList;

  container.style.display = "block";
}

function validateStep2() {
  if (!AppState.jsonTemplate || AppState.jsonFields.length === 0) {
    showNotification("Please upload JSON template file first", "error");
    return;
  }
  goToStep(3);
}

function handleCsvUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      parseCSV(e.target.result);
      showCSVPreview();
      document.getElementById("nextStep3").disabled = false;
      showNotification(
        `CSV loaded: ${AppState.csvData.length} rows, ${AppState.csvHeaders.length} columns`,
        "success",
      );
    } catch (error) {
      showNotification("Error parsing CSV: " + error.message, "error");
    }
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) {
    throw new Error("CSV must have at least 1 data row");
  }

  const headers = parseCSVLine(lines[0]);
  AppState.csvHeaders = headers.map((h) => h.replace(/^"|"$/g, "").trim());

  AppState.csvData = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;

    const values = parseCSVLine(lines[i]);

    if (values.length !== AppState.csvHeaders.length) {
      while (values.length < AppState.csvHeaders.length) {
        values.push("");
      }
      if (values.length > AppState.csvHeaders.length) {
        values.length = AppState.csvHeaders.length;
      }
    }

    const row = {};
    AppState.csvHeaders.forEach((header, index) => {
      const value = values[index] || "";
      row[header] = value.replace(/^"|"$/g, "").trim();
    });

    AppState.csvData.push(row);
  }

  AppState.stats.total = AppState.csvData.length;
}

function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      if (i + 1 < line.length && line[i + 1] === quoteChar) {
        current += char;
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function showCSVPreview() {
  const container = document.getElementById("csvPreview");
  const table = document.getElementById("previewTable");

  document.getElementById("csvRowCount").textContent =
    `${AppState.csvData.length} rows`;
  document.getElementById("csvColCount").textContent =
    `${AppState.csvHeaders.length} columns`;

  document.getElementById("autoMapToggleContainer").style.display = "block";
  document.getElementById("autoMapWarning").style.display = "block";

  let html = "<thead><tr><th>#</th>";
  AppState.csvHeaders.forEach((header) => {
    html += `<th>${header}</th>`;
  });
  html += "</tr></thead><tbody>";

  for (let i = 0; i < Math.min(5, AppState.csvData.length); i++) {
    html += `<tr><td>${i + 1}</td>`;
    AppState.csvHeaders.forEach((header) => {
      const value = AppState.csvData[i][header] || "";
      html += `<td title="${value}">${value.substring(0, 20)}${value.length > 20 ? "..." : ""}</td>`;
    });
    html += "</tr>";
  }
  html += "</tbody>";

  table.innerHTML = html;
  container.style.display = "block";
}

function validateStep3() {
  if (AppState.csvData.length === 0) {
    showNotification("Please upload CSV file first", "error");
    return;
  }
  goToStep(4);
}

function setupMappingUI() {
  if (!AppState.jsonFields || AppState.jsonFields.length === 0) {
    showNotification(
      "JSON template not loaded. Please go back and upload JSON first.",
      "error",
    );
    return;
  }

  const workspaceNameBuilder = document.getElementById("workspaceNameBuilder");
  
  if (workspaceNameBuilder && AppState.jsonFields.includes("workspace_name")) {
    workspaceNameBuilder.style.display = "block";
    setupWorkspaceNameBuilder();
  } else if (workspaceNameBuilder) {
    workspaceNameBuilder.style.display = "none";
  }

  const requiredFields = AppState.requiredFields.filter((f) =>
    AppState.jsonFields.includes(f),
  );
  const optionalFields = AppState.jsonFields.filter(
    (f) => !requiredFields.includes(f),
  );

  let requiredHtml = "";
  requiredFields.forEach((field) => {
    const fieldDisplay = field.replace(/\./g, " → ").replace(/_/g, " ");
    const fieldKey = field.replace(/\./g, "_");

    if (
      field === "workspace_name" &&
      workspaceNameBuilder &&
      workspaceNameBuilder.style.display === "block"
    ) {
      requiredHtml += `
          <div class="mapping-row required">
            <div class="row align-items-center">
              <div class="col-md-4">
                <label class="form-label fw-bold">${fieldDisplay} <span class="required-field">*</span></label>
                <div class="value-preview">(Built using workspace name builder)</div>
              </div>
              <div class="col-md-8">
                <select class="form-select" id="map_${fieldKey}" onchange="updateMappingWithPreview('${field}', this.value)" disabled>
                  <option value="">-- Using workspace name builder --</option>
                </select>
                <span class="mapped-value">Auto-generated</span>
              </div>
            </div>
          </div>
        `;
    } else {
      requiredHtml += `
          <div class="mapping-row required">
            <div class="row align-items-center">
              <div class="col-md-4">
                <label class="form-label fw-bold">${fieldDisplay} <span class="required-field">*</span></label>
                <div class="value-preview">${getSampleValueForField(field)}</div>
              </div>
              <div class="col-md-8">
                <select class="form-select" id="map_${fieldKey}" onchange="updateMappingWithPreview('${field}', this.value)">
                  <option value="">-- Select CSV Column --</option>
                  ${AppState.csvHeaders
                    .map(
                      (header) =>
                        `<option value="${header}" ${AppState.mappings[field] === header ? "selected" : ""}>${header}</option>`,
                    )
                    .join("")}
                </select>
                ${AppState.mappings[field] ? `<span class="mapped-value">Mapped to: ${AppState.mappings[field]}</span>` : ""}
              </div>
            </div>
          </div>
        `;
    }
  });
  document.getElementById("requiredMapping").innerHTML =
    requiredHtml ||
    "<p class='text-muted'>No required fields found in JSON template.</p>";

  let optionalHtml = "";
  optionalFields.forEach((field) => {
    const fieldDisplay = field.replace(/\./g, " → ").replace(/_/g, " ");
    const fieldKey = field.replace(/\./g, "_");
    const sampleValue = getSampleValueForField(field);

    optionalHtml += `
        <div class="mapping-row optional">
          <div class="row align-items-center">
            <div class="col-md-4">
              <label class="form-label">${fieldDisplay}</label>
              <div class="value-preview ${!sampleValue || sampleValue === "" ? "empty" : ""}">${sampleValue || "(empty in all rows)"}</div>
            </div>
            <div class="col-md-8">
              <select class="form-select" id="map_${fieldKey}" onchange="updateMappingWithPreview('${field}', this.value)">
                <option value="">-- Skip this field --</option>
                ${AppState.csvHeaders
                  .map(
                    (header) =>
                      `<option value="${header}" ${AppState.mappings[field] === header ? "selected" : ""}>${header}</option>`,
                  )
                  .join("")}
              </select>
              ${AppState.mappings[field] ? `<span class="mapped-value">Mapped to: ${AppState.mappings[field]}</span>` : ""}
            </div>
          </div>
        </div>
      `;
  });
  document.getElementById("optionalMapping").innerHTML =
    optionalHtml || "<p class='text-muted'>No optional fields found.</p>";

  const autoMapToggle = document.getElementById("autoMapToggle");
  if (autoMapToggle && autoMapToggle.checked) {
    console.log("Auto-mapping is ENABLED - running auto-map function");
    autoMapFieldsImproved();
  } else {
    console.log("Auto-mapping is DISABLED - skipping auto-map");
    AppState.jsonFields.forEach((field) => {
      if (!AppState.mappings[field]) {
        AppState.mappings[field] = "";
      }
    });
  }
}

function setupWorkspaceNameBuilder() {
  const availableFieldsDiv = document.getElementById("availableFields");
  const workspaceTemplateDiv = document.getElementById("workspaceTemplate");

  availableFieldsDiv.innerHTML = "";
  workspaceTemplateDiv.innerHTML = "";

  AppState.csvHeaders.forEach((header, index) => {
    const fieldToken = document.createElement("span");
    fieldToken.className = "field-token";
    fieldToken.textContent = header;
    fieldToken.dataset.field = header;
    fieldToken.draggable = true;

    fieldToken.addEventListener("dragstart", function (e) {
      e.dataTransfer.setData("text/plain", header);
      this.style.opacity = "0.5";
    });

    fieldToken.addEventListener("dragend", function () {
      this.style.opacity = "1";
    });

    fieldToken.addEventListener("click", function () {
      addFieldToWorkspaceName(header);
    });

    availableFieldsDiv.appendChild(fieldToken);

    if (index < AppState.csvHeaders.length - 1) {
      availableFieldsDiv.appendChild(document.createTextNode(" "));
    }
  });

  workspaceTemplateDiv.addEventListener("dragover", function (e) {
    e.preventDefault();
    this.style.backgroundColor = "rgba(67, 97, 238, 0.1)";
  });

  workspaceTemplateDiv.addEventListener("dragleave", function () {
    this.style.backgroundColor = "";
  });

  workspaceTemplateDiv.addEventListener("drop", function (e) {
    e.preventDefault();
    this.style.backgroundColor = "";
    const field = e.dataTransfer.getData("text/plain");
    if (field) {
      addFieldToWorkspaceName(field);
    }
  });

  if (AppState.workspaceNameTemplate.length === 0) {
    const possibleClientFields = AppState.csvHeaders.filter(
      (h) =>
        h.toLowerCase().includes("client") ||
        h.toLowerCase().includes("name") ||
        h.toLowerCase().includes("company"),
    );

    const possibleTitleFields = AppState.csvHeaders.filter(
      (h) =>
        h.toLowerCase().includes("title") ||
        h.toLowerCase().includes("project"),
    );

    if (possibleClientFields.length > 0) {
      addFieldToWorkspaceName(possibleClientFields[0]);
    }
    if (possibleTitleFields.length > 0) {
      addFieldToWorkspaceName(possibleTitleFields[0]);
    }
  } else {
    AppState.workspaceNameTemplate.forEach((field) => {
      addFieldToWorkspaceName(field);
    });
  }

  updateWorkspaceNamePreview();
}

function addFieldToWorkspaceName(field) {
  if (!AppState.workspaceNameTemplate.includes(field)) {
    AppState.workspaceNameTemplate.push(field);

    const workspaceTemplateDiv = document.getElementById("workspaceTemplate");
    const token = document.createElement("span");
    token.className = "field-token";
    token.textContent = field;
    token.dataset.field = field;

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-sm btn-link text-danger p-0 ms-1";
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.onclick = function () {
      const index = AppState.workspaceNameTemplate.indexOf(field);
      if (index > -1) {
        AppState.workspaceNameTemplate.splice(index, 1);
        token.remove();
        updateWorkspaceNamePreview();
      }
    };

    token.appendChild(removeBtn);
    workspaceTemplateDiv.appendChild(token);

    if (AppState.workspaceNameTemplate.length > 1) {
      workspaceTemplateDiv.appendChild(document.createTextNode(" "));
    }

    updateWorkspaceNamePreview();
  }
}

function updateWorkspaceNamePreview() {
  const previewDiv = document.getElementById("workspaceNamePreview");

  if (AppState.workspaceNameTemplate.length === 0) {
    previewDiv.textContent = "Preview will appear here";
    return;
  }

  const firstRow = AppState.csvData[0];
  if (!firstRow) {
    previewDiv.textContent = "No data available";
    return;
  }

  const parts = AppState.workspaceNameTemplate
    .map((field) => {
      const value = firstRow[field] || "";
      return value.trim();
    })
    .filter((part) => part !== "");

  const preview = parts.join(AppState.workspaceNameSeparator);
  previewDiv.textContent = preview || "(All fields are empty)";

  AppState.mappings.workspace_name = "built";
}

function getSampleValueForField(field) {
  const column = AppState.mappings[field];
  if (!column || !AppState.csvData.length) return "";

  for (let row of AppState.csvData) {
    if (row[column] && row[column].trim() !== "") {
      const value = row[column].trim();
      return value.length > 30 ? value.substring(0, 30) + "..." : value;
    }
  }
  return "";
}

function updateMappingWithPreview(field, value) {
  AppState.mappings[field] = value;

  const fieldKey = field.replace(/\./g, "_");
  const selectElement = document.getElementById(`map_${fieldKey}`);
  if (!selectElement) return;

  const row = selectElement.closest(".mapping-row");
  const previewDiv = row.querySelector(".value-preview");

  if (value && AppState.csvData.length > 0) {
    let sampleValue = "";
    for (let rowData of AppState.csvData) {
      if (rowData[value] && rowData[value].trim() !== "") {
        sampleValue = rowData[value].trim();
        break;
      }
    }
    if (sampleValue) {
      previewDiv.textContent =
        sampleValue.length > 30
          ? sampleValue.substring(0, 30) + "..."
          : sampleValue;
      previewDiv.classList.remove("empty");
    } else {
      previewDiv.textContent = "(empty in all rows)";
      previewDiv.classList.add("empty");
    }
  } else {
    previewDiv.textContent = "";
    previewDiv.classList.remove("empty");
  }

  const mappedValueSpan = row.querySelector(".mapped-value");
  if (value) {
    if (!mappedValueSpan) {
      const container = row.querySelector(".col-md-8");
      const span = document.createElement("span");
      span.className = "mapped-value";
      span.textContent = `Mapped to: ${value}`;
      container.appendChild(span);
    } else {
      mappedValueSpan.textContent = `Mapped to: ${value}`;
    }
  } else if (mappedValueSpan) {
    mappedValueSpan.remove();
  }
}

function autoMapFieldsImproved() {
  console.log("Running auto-mapping function...");
  
  const columnMap = {};
  AppState.csvHeaders.forEach((header) => {
    columnMap[header.toLowerCase().replace(/[^a-z0-9]/g, "")] = header;
  });

  let mappedCount = 0;

  AppState.jsonFields.forEach((field) => {
    const workspaceNameBuilder = document.getElementById("workspaceNameBuilder");
    if (
      field === "workspace_name" &&
      workspaceNameBuilder &&
      workspaceNameBuilder.style.display === "block"
    ) {
      return;
    }

    const fieldKey = field.replace(/\./g, "_");
    const fieldLower = field.toLowerCase().replace(/[^a-z0-9]/g, "");
    const fieldParts = field.split(".");
    const lastPart = fieldParts[fieldParts.length - 1]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    let matchedColumn = null;

    for (const col in columnMap) {
      const colHeader = columnMap[col];
      const colLower = colHeader.toLowerCase().replace(/[^a-z0-9]/g, "");
      
      const fieldWords = fieldLower.split(/_|\./);
      const colWords = colLower.split(/_|\./);
      
      for (const fWord of fieldWords) {
        if (fWord.length < 4) continue;
        
        for (const cWord of colWords) {
          if (cWord.length < 4) continue;
          
          if (fWord === cWord || 
              fWord === cWord + "s" || 
              cWord === fWord + "s" ||
              fWord.includes(cWord) || 
              cWord.includes(fWord)) {
            matchedColumn = colHeader;
            console.log(`Matched: ${field} → ${colHeader} (via word: ${fWord} / ${cWord})`);
            break;
          }
        }
        if (matchedColumn) break;
      }
      if (matchedColumn) break;
    }

    if (matchedColumn) {
      const selectEl = document.getElementById(`map_${fieldKey}`);
      if (selectEl && !selectEl.disabled) {
        selectEl.value = matchedColumn;
        AppState.mappings[field] = matchedColumn;
        mappedCount++;

        setTimeout(() => {
          updateMappingWithPreview(field, matchedColumn);
        }, 100);
      }
    } else {
      console.log(`No match found for: ${field}`);
    }
  });

  if (mappedCount > 0) {
    console.log(`Auto-mapped ${mappedCount} fields`);
    showNotification(`Auto-mapped ${mappedCount} fields. Please review carefully!`, "warning");
  } else {
    console.log("No fields were auto-mapped");
    showNotification("No automatic mappings found. Please map fields manually.", "info");
  }
}

function clearAllMappings() {
  if (confirm("This will clear all field mappings. Are you sure?")) {
    Object.keys(AppState.mappings).forEach(field => {
      const workspaceNameBuilder = document.getElementById("workspaceNameBuilder");
      if (!(field === "workspace_name" && workspaceNameBuilder && workspaceNameBuilder.style.display === "block")) {
        AppState.mappings[field] = "";
        
        const fieldKey = field.replace(/\./g, "_");
        const selectEl = document.getElementById(`map_${fieldKey}`);
        if (selectEl) {
          selectEl.value = "";
          updateMappingWithPreview(field, "");
        }
      }
    });
    
    showNotification("All mappings cleared", "info");
  }
}

function validateStep4() {
  const missing = AppState.requiredFields.filter((field) => {
    const workspaceNameBuilder = document.getElementById("workspaceNameBuilder");
    if (
      field === "workspace_name" &&
      workspaceNameBuilder &&
      workspaceNameBuilder.style.display === "block"
    ) {
      return false;
    }
    return !AppState.mappings[field] || AppState.mappings[field] === "";
  });

  if (missing.length > 0) {
    const fieldNames = missing.map((f) => f.replace(/_/g, " "));
    showNotification(
      `Please map required fields: ${fieldNames.join(", ")}`,
      "error"
    );
    return;
  }

  const autoMapToggle = document.getElementById("autoMapToggle");
  if (autoMapToggle && autoMapToggle.checked) {
    const mappedFields = Object.entries(AppState.mappings)
      .filter(([field, mapping]) => mapping && mapping !== "built" && mapping !== "")
      .map(([field, mapping]) => `${field} → ${mapping}`);

    if (mappedFields.length > 0) {
      const warning = `Auto-mapping was applied to ${mappedFields.length} fields. Please verify all mappings are correct before proceeding.`;
      showNotification(warning, "warning");
      
      if (!confirm(`Auto-mapping was applied to ${mappedFields.length} fields.\n\nPlease verify the mappings before launching.\n\nAre you sure the mappings are correct?`)) {
        return;
      }
    }
  }

  goToStep(5);
}

function showReview() {
  document.getElementById("reviewWebhookUrl").textContent =
    AppState.webhookConfig.url.substring(0, 50) +
    (AppState.webhookConfig.url.length > 50 ? "..." : "");

  document.getElementById("reviewJsonFields").textContent =
    AppState.jsonFields.length;
  document.getElementById("reviewRequiredFields").textContent =
    AppState.requiredFields.length;

  document.getElementById("reviewRowCount").textContent =
    AppState.csvData.length;
  document.getElementById("reviewColCount").textContent =
    AppState.csvHeaders.length;

  const autoMapToggle = document.getElementById("autoMapToggle");
  const autoMapStatus = autoMapToggle && autoMapToggle.checked ? "Enabled" : "Disabled";
  document.getElementById("reviewAutoMapStatus").textContent = autoMapStatus;

  let mappingsHtml = "";
  Object.entries(AppState.mappings).forEach(([field, column]) => {
    if (column) {
      const fieldDisplay = field.replace(/\./g, " → ").replace(/_/g, " ");
      let sampleValue = "";

      if (field === "workspace_name" && column === "built") {
        const firstRow = AppState.csvData[0];
        if (firstRow) {
          const parts = AppState.workspaceNameTemplate
            .map((f) => firstRow[f] || "")
            .filter((p) => p !== "");
          sampleValue = parts.join(AppState.workspaceNameSeparator);
        }
        mappingsHtml += `
            <div class="row mb-2">
              <div class="col-md-5"><strong>${fieldDisplay}:</strong></div>
              <div class="col-md-4"><span class="badge bg-info">Built from template</span></div>
              <div class="col-md-3 text-muted small">${sampleValue ? sampleValue.substring(0, 15) + (sampleValue.length > 15 ? "..." : "") : "empty"}</div>
            </div>
          `;
      } else if (column !== "") {
        if (AppState.csvData.length > 0) {
          for (let row of AppState.csvData) {
            if (row[column] && row[column].trim() !== "") {
              sampleValue = row[column].trim();
              break;
            }
          }
        }
        mappingsHtml += `
            <div class="row mb-2">
              <div class="col-md-5"><strong>${fieldDisplay}:</strong></div>
              <div class="col-md-4">${column}</div>
              <div class="col-md-3 text-muted small">${sampleValue ? sampleValue.substring(0, 15) + (sampleValue.length > 15 ? "..." : "") : "empty"}</div>
            </div>
          `;
      }
    }
  });
  document.getElementById("reviewMappings").innerHTML =
    mappingsHtml || "<p class='text-muted'>No mappings configured.</p>";
}

function validateAll() {
  const errors = [];

  AppState.csvData.forEach((row, index) => {
    if (AppState.mappings.workspace_name === "built") {
      if (AppState.workspaceNameTemplate.length === 0) {
        errors.push(`Row ${index + 1}: Workspace name template is empty`);
      } else {
        const parts = AppState.workspaceNameTemplate
          .map((field) => row[field] || "")
          .filter((p) => p.trim() !== "");
        if (parts.length === 0) {
          errors.push(`Row ${index + 1}: All workspace name fields are empty`);
        }
      }
    } else {
      const nameCol = AppState.mappings.workspace_name;
      if (nameCol && (!row[nameCol] || row[nameCol].trim() === "")) {
        errors.push(`Row ${index + 1}: workspace_name is empty`);
      }
    }

    const ownerCol = AppState.mappings.workspace_owner;
    if (!ownerCol || AppState.mappings.workspace_owner === "") {
      errors.push(`Row ${index + 1}: workspace_owner field not mapped`);
    } else {
      if (row[ownerCol] && row[ownerCol].trim() !== "") {
        const email = row[ownerCol];
        if (!isValidEmail(email)) {
          errors.push(
            `Row ${index + 1}: Invalid email format for workspace_owner`
          );
        }
      }
    }
  });

  const validationErrorsEl = document.getElementById("validationErrors");
  const validationSuccessEl = document.getElementById("validationSuccess");

  if (errors.length > 0) {
    const errorMessageEl = document.getElementById("errorMessage");
    if (errorMessageEl) {
      errorMessageEl.textContent =
        errors.slice(0, 5).join("; ") +
        (errors.length > 5 ? `; and ${errors.length - 5} more errors` : "");
    }
    
    if (validationErrorsEl) {
      validationErrorsEl.style.display = "block";
    }
    
    if (validationSuccessEl) {
      validationSuccessEl.style.display = "none";
    }
  } else {
    if (validationErrorsEl) {
      validationErrorsEl.style.display = "none";
    }
    
    if (validationSuccessEl) {
      validationSuccessEl.style.display = "block";
    }
    
    const autoMapToggle = document.getElementById("autoMapToggle");
    if (autoMapToggle && autoMapToggle.checked) {
      showNotification("⚠️ Auto-mapping was used. Please double-check all mappings before launching.", "warning");
    }
    
    setTimeout(() => {
      if (AppState.currentStep === 5) {
        goToStep(6);
      }
    }, 1000);
  }
}

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function resetLaunchState() {
  AppState.results = [];
  AppState.stats.success = 0;
  AppState.stats.failed = 0;
  AppState.processing = false;

  const consoleEl = document.getElementById("consoleOutput");
  const resultsTable = document.getElementById("resultsTable");
  const launchBtn = document.getElementById("launchBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const exportBtn = document.getElementById("exportBtn");

  if (consoleEl) {
    consoleEl.innerHTML = '<div class="log-entry"><span class="text-muted">Ready to launch flows...</span></div>';
  }
  
  if (resultsTable) {
    resultsTable.innerHTML = "";
  }
  
  if (launchBtn) {
    launchBtn.style.display = "block";
  }
  
  if (cancelBtn) {
    cancelBtn.style.display = "none";
  }
  
  if (exportBtn) {
    exportBtn.style.display = "none";
  }

  updateProgressDisplay();
}

function parseDateToTimestamp(dateString) {
  if (!dateString || dateString.trim() === "") {
    return null;
  }

  const str = dateString.trim();
  console.log(`Parsing date: "${str}"`);

  const formats = [
    {
      regex: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
      handler: (m) => {
        const month = parseInt(m[1]);
        const day = parseInt(m[2]);
        const year = parseInt(m[3]);
        
        if (month > 12) {
          return [year, day - 1, month];
        } else {
          return [year, month - 1, day];
        }
      }
    },
    {
      regex: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
      handler: (m) => [parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])],
    },
    {
      regex: /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
      handler: (m) => [parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])],
    },
    {
      regex: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})$/,
      handler: (m) => {
        const month = parseInt(m[1]);
        const day = parseInt(m[2]);
        const year = parseInt(m[3]);
        
        if (month > 12) {
          return [year, day - 1, month, parseInt(m[4]), parseInt(m[5])];
        } else {
          return [year, month - 1, day, parseInt(m[4]), parseInt(m[5])];
        }
      }
    },
    {
      regex:
        /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})$/,
      handler: (m) => [
        parseInt(m[1]),
        parseInt(m[2]) - 1,
        parseInt(m[3]),
        parseInt(m[4]),
        parseInt(m[5]),
        parseInt(m[6]),
      ],
    },
    {
      regex: /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/,
      handler: (m) => {
        const monthNames = [
          "january", "february", "march", "april", "may", "june",
          "july", "august", "september", "october", "november", "december"
        ];
        const monthIndex = monthNames.indexOf(m[1].toLowerCase());
        return monthIndex !== -1
          ? [parseInt(m[3]), monthIndex, parseInt(m[2])]
          : null;
      },
    },
    {
      regex: /^(\d{4})(\d{2})(\d{2})$/,
      handler: (m) => [parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])],
    },
  ];

  const mmddyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mmddyyyyMatch) {
    const month = parseInt(mmddyyyyMatch[1]);
    const day = parseInt(mmddyyyyMatch[2]);
    const year = parseInt(mmddyyyyMatch[3]);
    
    if (month > 12) {
      const date = new Date(year, day - 1, month);
      if (!isNaN(date.getTime())) {
        const timestamp = date.getTime();
        console.log(`✅ Date parsed as DD/MM/YYYY: ${date.toISOString()} = ${timestamp}ms`);
        return timestamp;
      }
    } else {
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        const timestamp = date.getTime();
        console.log(`✅ Date parsed as MM/DD/YYYY: ${date.toISOString()} = ${timestamp}ms`);
        return timestamp;
      }
    }
  }

  for (const format of formats) {
    const match = str.match(format.regex);
    if (match) {
      const dateArgs = format.handler(match);
      if (dateArgs) {
        const date = new Date(...dateArgs);
        if (!isNaN(date.getTime())) {
          const timestamp = date.getTime();
          console.log(
            `✅ Date parsed successfully: ${date.toISOString()} = ${timestamp}ms`
          );
          return timestamp;
        }
      }
    }
  }

  const timestamp = Date.parse(str);
  if (!isNaN(timestamp)) {
    console.log(`Date parsed via Date.parse: ${timestamp}ms`);
    return timestamp;
  }

  console.log(`Could not parse date: "${str}"`);
  return null;
}

// === MAIN LAUNCH FUNCTIONS ===
async function startLaunch() {
  if (AppState.processing) return;

  if (!AppState.webhookConfig.url) {
    showNotification("Webhook URL is required", "error");
    return;
  }

  AppState.processing = true;
  AppState.results = [];
  AppState.stats.success = 0;
  AppState.stats.failed = 0;

  const resultsTable = document.getElementById("resultsTable");
  if (resultsTable) resultsTable.innerHTML = "";

  const launchBtn = document.getElementById("launchBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  if (launchBtn) launchBtn.style.display = "none";
  if (cancelBtn) cancelBtn.style.display = "block";

  enableNoCloseWarning();
  updateSubmittingBanner();

  logMessage("🚀 Starting request submission...", "info");
  logMessage(`📊 Processing ${AppState.csvData.length} rows`, "info");

  for (let i = 0; i < AppState.csvData.length && AppState.processing; i++) {
    await processSingleRow(i);
    updateProgressDisplay();
    updateSubmittingBanner();
  }

  completeLaunch();
}

async function processSingleRow(rowIndex) {
  const row = AppState.csvData[rowIndex];
  let payload;
  let workspaceName = `Row ${rowIndex + 1}`;

  try {
    payload = buildPayload(row);
    workspaceName = payload.workspace_name || workspaceName;

    logMessage(`Row ${rowIndex + 1}: Submitting "${workspaceName}"`, "info");

    await delay(300);

    const result = await makeWebhookCallSimple(payload);

    if (result.status === "success") {
      AppState.stats.success++;
      AppState.results.push({ 
        row: rowIndex + 1, 
        status: "success", 
        workspace_name: workspaceName,
        data: result.data 
      });
      logMessage(`✅ Row ${rowIndex + 1}: Success!`, "success");
      updateResultTable(rowIndex + 1, workspaceName, "success");
      
    } else if (result.status === "failed") {
      AppState.stats.failed++;
      AppState.results.push({ 
        row: rowIndex + 1, 
        status: "error", 
        workspace_name: workspaceName, 
        message: result.error,
        statusCode: result.statusCode 
      });
      logMessage(`❌ Row ${rowIndex + 1}: ${result.error}`, "error");
      updateResultTable(rowIndex + 1, workspaceName, "error");
      
    } else {
      AppState.stats.failed++;
      AppState.results.push({ 
        row: rowIndex + 1, 
        status: "error", 
        workspace_name: workspaceName, 
        message: result.error 
      });
      logMessage(`❌ Row ${rowIndex + 1}: ${result.error}`, "error");
      updateResultTable(rowIndex + 1, workspaceName, "error");
    }

  } catch (e) {
    AppState.stats.failed++;
    const msg = e?.message || String(e);
    AppState.results.push({ 
      row: rowIndex + 1, 
      status: "error", 
      workspace_name: workspaceName, 
      message: msg 
    });
    logMessage(`❌ Row ${rowIndex + 1}: ${msg}`, "error");
    updateResultTable(rowIndex + 1, workspaceName, "error");
  }
}

async function makeWebhookCallWithRetry(payload, maxRetries = 2) {
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      const result = await makeWebhookCallSimple(payload);
      return result;
    } catch (error) {
      retryCount++;
      if (retryCount > maxRetries) {
        return {
          success: false,
          error: `Failed after ${maxRetries} retries: ${error.message}`,
        };
      }
      await delay(1000 * retryCount);
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function makeWebhookCallSimple(payload) {
  const timeoutMs = 15000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('/.netlify/functions/proxy-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: AppState.webhookConfig.url,
        payload: payload
      }),
      signal: controller.signal,
    });

    const result = await response.json();

    if (response.ok && result.ok) {
      return { 
        status: "success",
        data: result.data 
      };
    } else {
      let errorMsg = `Server error (${result.status})`;
      if (result.statusText) errorMsg += `: ${result.statusText}`;
      if (result.data) {
        if (typeof result.data === 'string') errorMsg += ` - ${result.data}`;
        else if (result.data.message) errorMsg += ` - ${result.data.message}`;
        else if (result.data.error) errorMsg += ` - ${result.data.error}`;
      }
      
      return { 
        status: "failed",
        error: errorMsg,
        statusCode: result.status,
        details: result.data
      };
    }

  } catch (e) {
    const msg = e?.name === "AbortError"
      ? `Network timeout after ${Math.floor(timeoutMs / 1000)}s`
      : `Network error: ${e?.message || e}`;
    
    return { 
      status: "network_failed", 
      error: msg 
    };
  } finally {
    clearTimeout(t);
  }
}

function buildPayload(row) {
  const payload = {};

  if (
    AppState.mappings.workspace_name === "built" &&
    AppState.workspaceNameTemplate.length > 0
  ) {
    const parts = AppState.workspaceNameTemplate
      .map((field) => row[field] || "")
      .filter((p) => p.trim() !== "");
    if (parts.length > 0) {
      payload.workspace_name = parts.join(AppState.workspaceNameSeparator);
    } else {
      payload.workspace_name = `Workspace ${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }
  }

  Object.entries(AppState.mappings).forEach(([jsonField, csvColumn]) => {
    if (
      jsonField === "workspace_name" &&
      AppState.mappings.workspace_name === "built"
    ) {
      return;
    }

    if (!csvColumn || csvColumn.trim() === "") {
      return;
    }

    const value = row[csvColumn];

    if (value === undefined || value === null || value === "") {
      return;
    }

    const trimmedValue = String(value).trim();
    if (trimmedValue === "") {
      return;
    }

    if (jsonField === "workspace_due_date") {
      const timestamp = parseDateToTimestamp(trimmedValue);
      if (timestamp !== null) {
        payload[jsonField] = timestamp;
        console.log(`✅ Date converted: "${trimmedValue}" → ${timestamp}ms`);
      } else {
        console.log(
          `❌ Could not parse date: "${trimmedValue}" for workspace_due_date`
        );
        logMessage(`⚠️ Could not parse date: "${trimmedValue}"`, "warning");
      }
    } else {
      payload[jsonField] = trimmedValue;
    }
  });

  if (!payload.workspace_name) {
    const nameCol = AppState.mappings.workspace_name;
    if (nameCol && row[nameCol] && row[nameCol].trim() !== "") {
      payload.workspace_name = row[nameCol].trim();
    } else {
      payload.workspace_name = `Workspace ${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }
  }

  if (!payload.workspace_owner) {
    const ownerCol = AppState.mappings.workspace_owner;
    if (ownerCol && row[ownerCol] && row[ownerCol].trim() !== "") {
      payload.workspace_owner = row[ownerCol].trim();
    }
  }

  console.log("📦 Final payload:", payload);
  return payload;
}

function completeLaunch() {
  AppState.processing = false;
  disableNoCloseWarning();

  const cancelBtn = document.getElementById("cancelBtn");
  const launchBtn = document.getElementById("launchBtn");
  if (cancelBtn) cancelBtn.style.display = "none";
  if (launchBtn) launchBtn.style.display = "block";

  const total = AppState.csvData.length;
  const success = AppState.stats.success;
  const failed = AppState.stats.failed;

  showSubmitBanner(
    `🚀 <strong>Requests have been submitted to Moxo.</strong><br/>
     Please verify workspace creation in your Moxo dashboard.<br/>
     Success: <strong>${success}</strong> / <strong>${total}</strong>
     ${failed ? `<br/>❌ Failed: <strong>${failed}</strong>` : ""}`,
    failed ? "danger" : "success"
  );

  showNotification(
    `Submission completed: ${success}/${total} successful. Verify in Moxo.`,
    failed ? "warning" : "info"
  );

  updateProgressDisplay();
}

function cancelLaunch() {
  AppState.processing = false;
  disableNoCloseWarning();

  showSubmitBanner("⏹️ Submission cancelled. Remaining rows were NOT submitted.", "info");
  logMessage("⏹️ Submission cancelled", "warning");

  const cancelBtn = document.getElementById("cancelBtn");
  const launchBtn = document.getElementById("launchBtn");
  if (cancelBtn) cancelBtn.style.display = "none";
  if (launchBtn) launchBtn.style.display = "block";
}

function updateProgressDisplay() {
  const processed = AppState.results.length;
  const total = AppState.csvData.length;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  const progressBar = document.getElementById("progressBar");
  const progressPercent = document.getElementById("progressPercent");
  const totalCount = document.getElementById("totalCount");
  const successCount = document.getElementById("successCount");
  const errorCount = document.getElementById("errorCount");

  if (progressBar) progressBar.style.width = `${percent}%`;
  if (progressPercent) progressPercent.textContent = `${percent}%`;
  if (totalCount) totalCount.textContent = total;

  if (successCount) successCount.textContent = AppState.stats.success;
  if (errorCount) errorCount.textContent = AppState.stats.failed;
}

function updateResultTable(rowNum, workspaceName, status) {
  const tbody = document.getElementById("resultsTable");
  if (!tbody) return;
  
  const row = document.createElement("tr");

  let text = "";
  let cls = "";

  if (status === "success") {
    text = "✅ Success";
    cls = "status-success";
  } else {
    text = "❌ Error";
    cls = "status-error";
  }

  row.innerHTML = `
    <td>${rowNum}</td>
    <td><small>${workspaceName.substring(0, 30)}${workspaceName.length > 30 ? "..." : ""}</small></td>
    <td><span class="status-badge ${cls}">${text}</span></td>
  `;

  tbody.appendChild(row);
}

function logMessage(message, type = "info") {
  const consoleEl = document.getElementById("consoleOutput");
  if (!consoleEl) return;
  
  const entry = document.createElement("div");
  entry.className = "log-entry";

  if (type === "success") {
    entry.innerHTML = `<span class="log-success">${message}</span>`;
  } else if (type === "error") {
    entry.innerHTML = `<span class="log-error">${message}</span>`;
  } else if (type === "warning") {
    entry.innerHTML = `<span class="text-warning">${message}</span>`;
  } else {
    entry.innerHTML = `<span>${message}</span>`;
  }

  consoleEl.appendChild(entry);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function showNotification(message, type = "info") {
  const existing = document.querySelector(".floating-notification");
  if (existing) existing.remove();

  const notification = document.createElement("div");
  notification.className = `floating-notification alert alert-${type === "error" ? "danger" : type === "success" ? "success" : "info"} shadow-lg`;
  notification.innerHTML = `
      <i class="fas fa-${type === "error" ? "exclamation-triangle" : type === "success" ? "check-circle" : "info-circle"} me-2"></i>
      ${message}
    `;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.transition = "all 0.3s ease";
      notification.style.opacity = "0";
      notification.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }, 5000);
}

function exportResults() {
  if (AppState.results.length === 0) {
    showNotification("No results to export", "error");
    return;
  }

  const headers = [
    "Row",
    "Workspace Name",
    "Status",
    "Message",
    "Workspace ID",
  ];
  const csvRows = [headers.join(",")];

  AppState.results.forEach((result) => {
    const row = [
      result.row,
      `"${result.workspace_name}"`,
      result.status,
      `"${result.message || ""}"`,
      `"${result.workspace_id || ""}"`,
    ];
    csvRows.push(row.join(","));
  });

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `moxo-results-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showNotification("Results exported successfully!", "success");
}

function addCustomField() {
  const name = prompt(
    "Enter custom attribute name (use dot notation for nested, e.g., 'custom.field'):",
  );
  if (!name) return;

  if (!AppState.jsonFields.includes(name)) {
    AppState.jsonFields.push(name);
    AppState.mappings[name] = "";
  }

  if (document.getElementById("customFieldsSection").style.display === "none") {
    document.getElementById("customFieldsSection").style.display = "block";
  }

  const fieldDisplay = name.replace(/\./g, " → ").replace(/_/g, " ");
  const fieldKey = name.replace(/\./g, "_");
  const customHtml = `
      <div class="mapping-row" id="custom_${fieldKey}">
        <div class="row align-items-center">
          <div class="col-md-4">
            <label class="form-label">${fieldDisplay}</label>
            <div class="value-preview"></div>
          </div>
          <div class="col-md-6">
            <select class="form-select" id="map_${fieldKey}" onchange="updateMappingWithPreview('${name}', this.value)">
              <option value="">-- Skip this field --</option>
              ${AppState.csvHeaders
                .map((header) => `<option value="${header}">${header}</option>`)
                .join("")}
            </select>
          </div>
          <div class="col-md-2">
            <button class="btn btn-sm btn-outline-danger" onclick="removeCustomField('${name}')">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      </div>
    `;

  document.getElementById("customMapping").innerHTML += customHtml;
}

function removeCustomField(name) {
  const fieldKey = name.replace(/\./g, "_");
  const element = document.getElementById(`custom_${fieldKey}`);
  if (element) {
    element.remove();
    delete AppState.mappings[name];
    const index = AppState.jsonFields.indexOf(name);
    if (index > -1) {
      AppState.jsonFields.splice(index, 1);
    }
  }
}

function shouldSkipField(value) {
  if (value === undefined || value === null || value === "") {
    return true;
  }
  
  if (typeof value === 'string' && value.trim() === "") {
    return true;
  }
  
  return false;
}

function showSubmitBanner(html, type = "info") {
  const el = document.getElementById("submitBanner");
  if (!el) return;
  el.className = `alert alert-${type} shadow-sm`;
  el.innerHTML = html;
  el.classList.remove("d-none");
}

function enableNoCloseWarning() {
  window.onbeforeunload = function () {
    return "Submission is in progress. If you leave, remaining requests will NOT be submitted.";
  };
}

function disableNoCloseWarning() {
  window.onbeforeunload = null;
}

function getSubmittedCount() {
  return AppState.results.filter(r => r.status === "success").length;
}

function updateSubmittingBanner() {
  const success = AppState.stats.success;
  const total = AppState.csvData.length;
  showSubmitBanner(
    `⏳ <strong>Submitting requests…</strong> Keep this tab open.<br/>
     Success: <strong>${success}</strong> / <strong>${total}</strong>`,
    "warning"
  );
}