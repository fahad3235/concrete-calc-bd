// Concrete Calculator BD - DOM wiring. All visible strings come from js/i18n.js.
'use strict';
(function () {
  var C = window.Concrete;
  var TEXT_IDS = ['appTitle', 'appTagline', 'calcHeading', 'lblElType', 'lblUnit', 'lblQty',
    'lblMix', 'lblWastage', 'priceHeading', 'lblPriceBag', 'lblPriceSand', 'lblPriceAgg',
    'calcBtn', 'addBtn', 'projectHeading', 'projectEmpty', 'thEl', 'thVol', 'thBags',
    'thSand', 'thAgg', 'thCost', 'exportBtn', 'importLabel', 'lblClear', 'clearBtn',
    'methodHeading', 'footerNote'];
  var METHOD_IDS = ['method1', 'method2', 'method3', 'method4', 'method5'];
  var LS_PROJECT = 'concrete-calc-bd:project';
  var LS_LANG = 'concrete-calc-bd:lang';

  var lang = localStorage.getItem(LS_LANG) || 'en';
  var project = loadProject();
  var lastCalc = null;

  function $(id) { return document.getElementById(id); }
  function t() { return window.I18N[lang]; }
  function num(str) { return str === '' || str === null ? NaN : Number(str); }
  function disp(s) { return lang === 'bn' ? C.toBnDigits(s) : s; }
  function money(bdt) { return disp(C.fmt(bdt, 2)); }

  function loadProject() {
    try {
      var raw = localStorage.getItem(LS_PROJECT);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (data && data.app === 'concrete-calc-bd' && data.version === 1 && Array.isArray(data.items) &&
          data.items.every(C.validateItem)) return data.items;
    } catch (e) { /* corrupt save -> start empty */ }
    return [];
  }
  function saveProject() {
    localStorage.setItem(LS_PROJECT, JSON.stringify({ app: 'concrete-calc-bd', version: 1, items: project }));
  }

  function applyLang() {
    var s = t();
    TEXT_IDS.forEach(function (id) { if (s[id]) $(id).textContent = s[id]; });
    var lis = document.querySelectorAll('#methodList li');
    METHOD_IDS.forEach(function (key, i) { if (lis[i] && s[key]) lis[i].textContent = s[key]; });
    var elSel = $('elType');
    Object.keys(s.elNames).forEach(function (k) {
      var o = elSel.querySelector('option[value="' + k + '"]');
      if (o) o.textContent = s.elNames[k];
    });
    var mixSel = $('mixSel');
    Object.keys(s.mixNames).forEach(function (k) {
      var o = mixSel.querySelector('option[value="' + k + '"]');
      if (o) o.textContent = s.mixNames[k];
    });
    $('langBtn').textContent = lang === 'en' ? s.langBtn : s.langBtnOther;
    document.documentElement.lang = lang;
    refreshDimLabels();
    renderProject();
    if (lastCalc) renderResult(lastCalc);
  }

  function refreshDimLabels() {
    var s = t();
    var el = $('elType').value;
    var dims = C.DIMS[el];
    $('dim1Label').textContent = s.dimNames[dims[0]];
    $('dim2Label').textContent = s.dimNames[dims[1]];
    var wrap = $('dim3Wrap');
    if (dims.length > 2) {
      wrap.classList.remove('hidden');
      $('dim3Label').textContent = s.dimNames[dims[2]];
    } else {
      wrap.classList.add('hidden');
    }
    $('customRatioWrap').classList.toggle('hidden', $('mixSel').value !== 'custom');
  }

  function showError(msg) {
    var e = $('formError');
    e.textContent = msg;
    e.classList.toggle('hidden', !msg);
  }

  function readForm() {
    var s = t();
    var el = $('elType').value;
    var dims = C.DIMS[el];
    var vals = [num($('d1').value), num($('d2').value), num($('d3').value)].slice(0, dims.length);
    if (vals.some(function (v) { return !(v > 0) || !isFinite(v); })) throw new Error(s.errDims);
    var qty = num($('qty').value);
    if (!(qty >= 1) || Math.floor(qty) !== qty) throw new Error(s.errQty);
    var wastage = num($('wastage').value);
    if (isNaN(wastage)) wastage = 0;
    if (!(wastage >= 0) || wastage > 50) throw new Error(s.errWastage);
    var mixKey = $('mixSel').value;
    var custom = null;
    if (mixKey === 'custom') {
      custom = { c: num($('rC').value), s: num($('rS').value), a: num($('rA').value) };
      if (!(custom.c > 0) || !(custom.s > 0) || !(custom.a > 0)) throw new Error(s.errRatio);
    }
    var prices = { bag: $('priceBag').value, sand: $('priceSand').value, agg: $('priceAgg').value };
    Object.keys(prices).forEach(function (k) {
      if (prices[k] !== '' && !(Number(prices[k]) >= 0)) throw new Error(s.errPrice);
    });
    return { element: el, dims: vals, unit: $('unitSel').value, qty: qty, mix: mixKey, custom: custom, wastage: wastage, prices: prices };
  }

  function calculate() {
    var s = t();
    try {
      var f = readForm();
      var vol = C.volumeM3(f.element, f.dims, f.unit);
      var parts = C.mixParts(f.mix, f.custom);
      var mat = C.materials(vol, parts, f.qty, f.wastage);
      var cost = C.costPaisa(mat, f.prices);
      lastCalc = { form: f, mat: mat, cost: cost };
      showError('');
      renderResult(lastCalc);
      $('addBtn').disabled = false;
    } catch (e) {
      lastCalc = null;
      $('addBtn').disabled = true;
      $('resultBox').classList.add('hidden');
      showError(e.message === 'dims must be positive numbers' ? s.errDims :
        e.message === 'qty must be a positive integer' ? s.errQty :
        e.message === 'wastage must be 0-50' ? s.errWastage :
        e.message === 'ratio parts must be positive' ? s.errRatio :
        e.message === 'prices must be non-negative' ? s.errPrice : e.message);
    }
  }

  function renderResult(calc) {
    var s = t();
    var f = calc.form, m = calc.mat;
    var dimStr = f.dims.join(' x ') + ' ' + f.unit;
    var html = '<p class="big">' + s.resFor + ' ' + s.elNames[f.element] + ' (' + disp(dimStr) +
      (f.qty > 1 ? ' x ' + disp(String(f.qty)) : '') + ')</p>';
    html += '<p>' + s.resVol + ': ' + disp(C.fmt(m.wetM3)) + ' m&#179; (' + disp(C.fmt(m.wetFt3)) + ' ft&#179;)</p>';
    html += '<p>' + s.resDry + ': ' + disp(C.fmt(m.dryM3)) + ' m&#179;</p>';
    html += '<p>' + s.resCement + ': ' + disp(C.fmt(m.cementKg)) + ' kg = ' + disp(C.fmt(m.bagsExact)) +
      ' ' + s.bags + ' (' + s.buy + ' ' + disp(String(m.bagsWhole)) + ' ' + s.bags + ')</p>';
    html += '<p>' + s.resSand + ': ' + disp(C.fmt(m.sandM3)) + ' m&#179; (' + disp(C.fmt(m.sandFt3)) + ' ft&#179;)</p>';
    html += '<p>' + s.resAgg + ': ' + disp(C.fmt(m.aggM3)) + ' m&#179; (' + disp(C.fmt(m.aggFt3)) + ' ft&#179;)</p>';
    if (calc.cost) {
      html += '<p class="big">' + s.resCost + ': &#2547;' + money(calc.cost.totalBDT) + '</p>';
    }
    var box = $('resultBox');
    box.innerHTML = html;
    box.classList.remove('hidden');
  }

  function renderProject() {
    var s = t();
    var empty = $('projectEmpty'), table = $('projectTable'), body = $('projectBody');
    empty.classList.toggle('hidden', project.length > 0);
    table.classList.toggle('hidden', project.length === 0);
    body.innerHTML = '';
    project.forEach(function (it, i) {
      var tr = document.createElement('tr');
      var costTxt = it.cost ? '&#2547;' + money(it.cost.totalBDT) : '-';
      tr.innerHTML = '<td>' + s.elNames[it.element] + ' (' + disp(it.dims.join(' x ')) + ' ' + it.unit +
        (it.qty > 1 ? ' x ' + disp(String(it.qty)) : '') + ')</td>' +
        '<td>' + disp(C.fmt(it.mat.wetM3)) + ' m&#179;</td>' +
        '<td>' + disp(String(it.mat.bagsWhole)) + '</td>' +
        '<td>' + disp(C.fmt(it.mat.sandFt3)) + ' ft&#179;</td>' +
        '<td>' + disp(C.fmt(it.mat.aggFt3)) + ' ft&#179;</td>' +
        '<td>' + costTxt + '</td>' +
        '<td><button type="button" data-del="' + i + '">' + s.deleteBtn + '</button></td>';
      body.appendChild(tr);
    });
    body.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        project.splice(Number(b.getAttribute('data-del')), 1);
        saveProject(); renderProject();
      });
    });
    var tot = C.totals(project);
    var foot = $('totalsRow');
    foot.innerHTML = '<td>' + s.totalRow + '</td>' +
      '<td>' + disp(C.fmt(tot.wetM3)) + ' m&#179;</td>' +
      '<td>' + disp(String(tot.bagsWhole)) + '</td>' +
      '<td>' + disp(C.fmt(tot.sandFt3)) + ' ft&#179;</td>' +
      '<td>' + disp(C.fmt(tot.aggFt3)) + ' ft&#179;</td>' +
      '<td>' + (tot.hasCost ? '&#2547;' + money(tot.costPaisa / 100) : '-') + '</td><td></td>';
  }

  function exportJSON() {
    var blob = new Blob([JSON.stringify({ app: 'concrete-calc-bd', version: 1, items: project }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'concrete-project.json';
    a.click();
    URL.revokeObjectURL(a.href);
    $('dataMsg').textContent = t().msgExported;
  }

  function importJSON(file) {
    var s = t();
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!C.validateImport(data)) throw new Error('bad');
        project = data.items;
        saveProject(); renderProject();
        $('dataMsg').textContent = s.msgImported;
      } catch (e) {
        $('dataMsg').textContent = s.msgImportBad;
      }
    };
    reader.readAsText(file);
  }

  $('calcBtn').addEventListener('click', calculate);
  $('addBtn').addEventListener('click', function () {
    if (!lastCalc) return;
    var f = lastCalc.form;
    project.push({ element: f.element, dims: f.dims, unit: f.unit, qty: f.qty,
      mix: f.mix, custom: f.custom, wastage: f.wastage, mat: lastCalc.mat,
      cost: lastCalc.cost });
    saveProject(); renderProject();
    $('dataMsg').textContent = t().msgAdded;
  });
  $('elType').addEventListener('change', refreshDimLabels);
  $('mixSel').addEventListener('change', refreshDimLabels);
  $('langBtn').addEventListener('click', function () {
    lang = lang === 'en' ? 'bn' : 'en';
    localStorage.setItem(LS_LANG, lang);
    applyLang();
  });
  $('exportBtn').addEventListener('click', exportJSON);
  $('importFile').addEventListener('change', function () {
    if (this.files[0]) importJSON(this.files[0]);
    this.value = '';
  });
  $('clearInput').addEventListener('input', function () {
    $('clearBtn').disabled = this.value !== 'DELETE';
  });
  $('clearBtn').addEventListener('click', function () {
    project = [];
    saveProject(); renderProject();
    $('clearInput').value = '';
    $('clearBtn').disabled = true;
    $('dataMsg').textContent = t().msgCleared;
  });

  refreshDimLabels();
  applyLang();
})();
