(function () {
  function isPoland(value) {
    var v = (value || '').toString().trim().toLowerCase();
    return v === 'poland' || v === 'polska' || v === 'pl';
  }

  function formatPlPostalCode(raw) {
    var digits = (raw || '').toString().replace(/\D/g, '').slice(0, 5);
    if (digits.length <= 2) return digits;
    return digits.slice(0, 2) + '-' + digits.slice(2);
  }

  function countDigitsBeforeCaret(value, caretPos) {
    var left = (value || '').toString().slice(0, Math.max(0, caretPos || 0));
    var m = left.match(/\d/g);
    return m ? m.length : 0;
  }

  function caretPosFromDigitIndex(formatted, digitIndex) {
    if (!digitIndex) return 0;
    var count = 0;
    for (var i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted.charAt(i))) {
        count++;
        if (count >= digitIndex) return i + 1;
      }
    }
    return formatted.length;
  }

  function attach(form) {
    if (!form || form.__postalCodeBound) return;
    form.__postalCodeBound = true;

    var postal = form.querySelector('#postalCode, input[name="postalCode"]');
    if (!postal) return;

    var country = form.querySelector('#country, input[name="country"]');

    function shouldFormat() {
      return country && isPoland(country.value);
    }

    function onInput() {
      if (!shouldFormat()) return;
      var before = postal.value;
      var caret = typeof postal.selectionStart === 'number' ? postal.selectionStart : before.length;
      var digitIndex = countDigitsBeforeCaret(before, caret);

      var formatted = formatPlPostalCode(before);
      if (formatted === before) return;

      postal.value = formatted;

      var newCaret = caretPosFromDigitIndex(formatted, digitIndex);
      try {
        postal.setSelectionRange(newCaret, newCaret);
      } catch (e) {
        // ignore
      }
    }

    postal.addEventListener('input', onInput);
    postal.addEventListener('blur', onInput);
    if (country) {
      country.addEventListener('change', onInput);
      country.addEventListener('blur', onInput);
    }
  }

  function init() {
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i++) attach(forms[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
