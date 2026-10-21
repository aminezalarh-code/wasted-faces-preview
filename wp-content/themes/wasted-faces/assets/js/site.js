/**
 * Site behaviour: header, mobile menu, scroll reveals, fashion tilt,
 * lightbox and the gallery concierge.
 */
(function () {
	'use strict';

	var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* ---------------- Header state ---------------- */
	var header = document.querySelector('[data-header]');
	function onScroll() {
		if (header) header.classList.toggle('is-scrolled', window.scrollY > 24);
	}
	window.addEventListener('scroll', onScroll, { passive: true });
	onScroll();

	/* ---------------- Mobile menu ---------------- */
	var toggle = document.querySelector('[data-nav-toggle]');
	var nav = document.querySelector('[data-nav]');
	function setMenu(open) {
		if (!toggle || !nav) return;
		toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
		document.body.classList.toggle('menu-open', open);
		if (open) {
			var first = nav.querySelector('a');
			if (first) first.focus();
		}
	}
	if (toggle) {
		toggle.addEventListener('click', function () {
			setMenu(toggle.getAttribute('aria-expanded') !== 'true');
		});
	}
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
			setMenu(false);
			toggle.focus();
		}
	});
	if (nav) {
		nav.addEventListener('click', function (e) {
			if (e.target.closest('a')) setMenu(false);
		});
	}

	/* ---------------- Reveal on scroll ---------------- */
	var reveals = document.querySelectorAll('.reveal');
	if ('IntersectionObserver' in window && !reduceMotion) {
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (entry.isIntersecting) {
					entry.target.classList.add('is-in');
					io.unobserve(entry.target);
				}
			});
		}, { rootMargin: '0px 0px -8% 0px' });
		reveals.forEach(function (el) { io.observe(el); });
	} else {
		reveals.forEach(function (el) { el.classList.add('is-in'); });
	}

	/* ---------------- Fashion 3D tilt ---------------- */
	if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
		document.querySelectorAll('[data-tilt]').forEach(function (card) {
			var inner = card.firstElementChild;
			card.addEventListener('pointermove', function (e) {
				var r = card.getBoundingClientRect();
				var x = (e.clientX - r.left) / r.width - 0.5;
				var y = (e.clientY - r.top) / r.height - 0.5;
				inner.style.transform = 'rotateY(' + (x * 14).toFixed(2) + 'deg) rotateX(' + (-y * 12).toFixed(2) + 'deg) translateZ(10px)';
				inner.style.setProperty('--gx', ((x + 0.5) * 100).toFixed(1) + '%');
				inner.style.setProperty('--gy', ((y + 0.5) * 100).toFixed(1) + '%');
			});
			card.addEventListener('pointerleave', function () {
				inner.style.transform = '';
			});
		});
	}

	/* ---------------- Lightbox ---------------- */
	var dialog = document.querySelector('[data-lightbox-dialog]');
	if (dialog && typeof dialog.showModal === 'function') {
		var img = dialog.querySelector('[data-lightbox-img]');
		document.addEventListener('click', function (e) {
			var link = e.target.closest('[data-lightbox]');
			if (!link) return;
			e.preventDefault();
			img.src = link.getAttribute('href');
			img.alt = link.getAttribute('data-alt') || '';
			dialog.showModal();
		});
		dialog.addEventListener('click', function (e) {
			if (e.target === dialog || e.target.closest('[data-lightbox-close]')) dialog.close();
		});
	}

	/* ---------------- Concierge ---------------- */
	var panel = document.querySelector('[data-concierge]');
	if (!panel) return;

	var openers = document.querySelectorAll('[data-concierge-open]');
	var log = panel.querySelector('[data-concierge-log]');
	var form = panel.querySelector('[data-concierge-form]');
	var input = form ? form.querySelector('input') : null;
	var dataEl = panel.querySelector('[data-concierge-faq]');
	var fallbackEl = panel.querySelector('[data-concierge-fallback]');
	var faqs = [];
	try { faqs = JSON.parse(dataEl ? dataEl.textContent : '[]'); } catch (err) { faqs = []; }
	var lastOpener = null;

	function setOpen(open) {
		panel.hidden = !open;
		document.body.classList.toggle('concierge-open', open);
		openers.forEach(function (b) { b.setAttribute('aria-expanded', open ? 'true' : 'false'); });
		if (open) {
			if (input) input.focus();
		} else if (lastOpener) {
			lastOpener.focus();
		}
	}

	openers.forEach(function (btn) {
		btn.addEventListener('click', function () {
			lastOpener = btn;
			setOpen(panel.hidden);
		});
	});
	panel.querySelector('[data-concierge-close]').addEventListener('click', function () { setOpen(false); });
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape' && !panel.hidden) setOpen(false);
	});

	function say(text, who) {
		var p = document.createElement('p');
		p.className = 'msg msg--' + who;
		p.textContent = text;
		log.appendChild(p);
		log.scrollTop = log.scrollHeight;
	}

	function answer(question) {
		var words = question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2; });
		var best = null, bestScore = 0;
		faqs.forEach(function (f) {
			var hay = (f.q + ' ' + f.a).toLowerCase();
			var score = 0;
			words.forEach(function (w) {
				if (hay.indexOf(w) !== -1) score += f.q.toLowerCase().indexOf(w) !== -1 ? 2 : 1;
			});
			if (score > bestScore) { bestScore = score; best = f; }
		});
		return bestScore >= 2 ? best.a : (fallbackEl ? fallbackEl.content.textContent : '');
	}

	panel.addEventListener('click', function (e) {
		var chip = e.target.closest('[data-faq]');
		if (!chip) return;
		var f = faqs[parseInt(chip.getAttribute('data-faq'), 10)];
		if (!f) return;
		say(f.q, 'user');
		setTimeout(function () { say(f.a, 'bot'); }, reduceMotion ? 0 : 280);
	});

	if (form) {
		form.addEventListener('submit', function (e) {
			e.preventDefault();
			var q = input.value.trim();
			if (!q) return;
			say(q, 'user');
			input.value = '';
			var wa = panel.querySelector('[data-concierge-wa]');
			if (wa) {
				var base = wa.getAttribute('href').split('?')[0];
				wa.setAttribute('href', base + '?text=' + encodeURIComponent('Hello THE WASTED FACES concierge, ' + q));
			}
			setTimeout(function () { say(answer(q), 'bot'); }, reduceMotion ? 0 : 320);
		});
	}
})();
