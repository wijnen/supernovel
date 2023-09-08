'use strict';
function richinput(element) {
	var translation = [
		{0x30: '⁰', 0x31: '¹', 0x32: '²', 0x33: '³', 0x34: '⁴', 0x35: '⁵', 0x36: '⁶', 0x37: '⁷', 0x38: '⁸', 0x39: '⁹', 45: '⁻', 43: '⁺', 61: '⁼', 40: '⁽', 41: '⁾', 110: 'ⁿ'},
		{0x30: '₀', 0x31: '₁', 0x32: '₂', 0x33: '₃', 0x34: '₄', 0x35: '₅', 0x36: '₆', 0x37: '₇', 0x38: '₈', 0x39: '₉', 45: '₋', 43: '₊', 61: '₌', 40: '₍', 41: '₎', 97: 'ₐ', 101: 'ₑ', 111: 'ₒ', 120: 'ₓ', 104: 'ₕ', 107: 'ₖ', 108: 'ₗ', 109: 'ₘ', 110: 'ₙ', 112: 'ₚ', 115: 'ₛ', 116: 'ₜ'}
	];
	var inputs = element.getElementsByTagName('input');
	if (inputs.length == 0) {
		inputs = element.getElementsByTagName('textarea');
		if (inputs.length == 0) {
			console.error('richinput called on element without input or textarea children');
			return;
		}
	}
	var input = inputs[0];
	input.power = null;
	var actions = [
		[function(e) { e.AddText('·10').AddElement('sup').AddText('x'); }, '·10', true, false],
		[function(e) { e.AddText('n').AddElement('sup').AddText('x'); }, '', true, true],
		[function(e) { e.AddText('n').AddElement('sub').AddText('x'); }, '', false, true],
	];
	input.AddEvent('keydown', function(event) {
		// Cursor keys and space finish power mode.
		if (event.key != ' ' && (event.keyCode < 37 || event.keyCode > 40))
			return;
		this.power = null;
		actions[1][4].checked = false;
		actions[2][4].checked = false;
		//console.info(event.keyCode);
	});
	input.AddEvent('keypress', function(event) {
		//var dbg = document.getElementById('debug');
		//dbg.AddElement('p').AddText('keypress charcode ' + event.charCode + ' keycode ' + event.keyCode);
		if (this.power === true) {
			var c = translation[0][event.charCode];
			if (c !== undefined) {
				event.preventDefault();
				this.value += c;
				return;
			}
		}
		else if (this.power === false) {
			var c = translation[1][event.charCode];
			if (c !== undefined) {
				event.preventDefault();
				this.value += c;
				return;
			}
		}
	});
	element.AddElement('br');
	for (var a = 0; a < actions.length; ++a) {
		var button;
		if (actions[a][3]) {
			var label = element.AddElement('label');
			button = label.AddElement('input');
			button.type = 'checkbox';
			button.input = input;
			button.action = actions[a];
			button.actions = actions;
			button.other = 3 - a;
			actions[a][0](label);
			actions[a].push(button);
			button.change = function() {
				if (this.checked) {
					this.input.value += this.action[1];
					this.input.power = this.action[2];
					this.actions[this.other][4].checked = false;
				}
				else {
					this.input.power = null;
					this.actions[this.other][4].checked = false;
				}
				this.input.focus();
			};
			button.AddEvent('change', button.change);
		}
		else {
			button = element.AddElement('button');
			button.type = 'button';
			button.input = input;
			button.action = actions[a];
			actions[a][0](button);
			button.click = function() {
				actions[1][4].checked = true;
				actions[2][4].checked = false;
				this.input.value += this.action[1];
				this.input.power = this.action[2];
				this.input.focus();
			};
			button.AddEvent('click', button.click);
		}
	}
	var symbols = '·°€πμΔφηλρεσαβγ';
	for (var s = 0; s < symbols.length; ++s) {
		if (s % 3 == 0)
			element.AddElement('br');
		var button = element.AddElement('button');
		button.input = input;
		//button.style.padding = '0px 0px 0px 0px';
		button.type = 'button';
		button.symbol = symbols[s];
		button.AddText(button.symbol);
		button.AddEvent('click', function() {
			this.input.value += this.symbol;
			this.input.focus();
		});
	}
}
window.AddEvent('load', function() {
	var elements = document.getElementsByClassName('richinput');
	for (var e = 0; e < elements.length; ++e) {
		// Disable this for now.
		//richinput(elements[e]);
	}
});
