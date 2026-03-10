// Dark-Mode sofort anwenden (vor React-Mount, verhindert Flicker)
(function(){
  var c = (document.cookie.match(/(?:^|;\s*)fw_theme=(\w+)/) || [])[1];
  if (c) {
    localStorage.setItem('theme', c);
    document.documentElement.classList.toggle('dark', c === 'dark');
  }
})();
