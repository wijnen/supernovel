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
	input.AddEvent('keydown', function(event) {
		// Cursor keys finish power mode.
		if (event.keyCode < 37 || event.keyCode > 40)
			return;
		this.power = null;
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
		this.power = null;
	});
	element.AddElement('br');
	var actions = [
		[function(e) { e.AddText('·10').AddElement('sup').AddText('x'); }, '·10', true],
		[function(e) { e.AddText('n').AddElement('sup').AddText('x'); }, '', true],
		[function(e) { e.AddText('n').AddElement('sub').AddText('x'); }, '', false]
	];
	for (var a = 0; a < actions.length; ++a) {
		var button = element.AddElement('button');
		button.type = 'button';
		button.input = input;
		actions[a][0](button);
		button.action = actions[a];
		button.AddEvent('click', function() {
			this.input.value += this.action[1];
			this.input.power = this.action[2];
			this.input.focus();
		});
	}
	var symbols = 'πμΔφηλρεσαβγ';
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
	for (var e = 0; e < elements.length; ++e)
		richinput(elements[e]);
});
