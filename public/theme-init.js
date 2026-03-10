// Dark-Mode sofort anwenden (vor React-Mount, verhindert Flicker)
(function(){
  var c = (document.cookie.match(/(?:^|;\s*)fw_theme=(\w+)/) || [])[1];
  var t = c || localStorage.getItem('theme');
  if (t) {
    document.documentElement.classList.toggle('dark', t === 'dark');
    if (c) localStorage.setItem('theme', c);
  }
})();
