
const switchInput = document.getElementById('boutton');
const switchStatus = document.querySelector('.switch-status');

switchInput.addEventListener('change', function() {
  switchStatus.textContent = this.checked ? 'Oui' : 'Non';
});