"use strict";
var server, contents;

function init() { // {{{
	contents = document.getElementById('contents');
	server = Rpc(Connection, onopen, onclose);
} // }}}
window.AddEvent('load', init);

function onopen() { // {{{
	document.body.AddClass('open');
} // }}}

function onclose() { // {{{
	document.body.RemoveClass('open');
} // }}}

var Connection = { // {{{
	userdata_setup: userdata_setup,
	select_group: select_group,
	select_script: select_script,
	show_script: show_script,
	show_player: show_player,
	show_question: show_question
}; // }}}

function select_group(groups) { // {{{
	contents.ClearAll();
	contents.AddElement('h1').AddText('Select Group');
	var select = contents.AddElement('select');
	select.AddElement('option').AddText('Please Select Group');
	for (var g = 0; g < groups.length; ++g)
		select.AddElement('option').AddText(groups[g]);
	select.AddEvent('change', function() {
		if (select.selectedIndex == 0)
			return;
		server.call('select_script', [groups[select.selectedIndex - 1]]);
	});
} // }}}

function select_script(group, scripts) { // {{{
	contents.ClearAll();
	contents.AddElement('h1').AddText('Select Script');
	contents.AddElement('p').AddText('Selected group: ' + group);
	var select = contents.AddElement('select');
	select.AddElement('option').AddText('Please Select Script');
	for (var s = 0; s < scripts.length; ++s)
		select.AddElement('option').AddText(scripts[s].join('/'));
	select.AddEvent('change', function() {
		if (select.selectedIndex == 0)
			return;
		server.call('show_script', [scripts[select.selectedIndex - 1]]);
	});
} // }}}

function show_script(script, players, questions) { // {{{
	contents.ClearAll();
	console.info('show script', script, players, questions);
	contents.AddElement('h1').AddText('Script: ' + script.join('/'));
	var table = contents.AddElement('table');
	var tr = table.AddElement('tr');
	tr.AddElement('th');
	for (var p = 0; p < players.length; ++p) {
		var th = tr.AddElement('th');
		th.title = players[p].fullname;
		th.AddText(players[p].name);
		th.player = p;
		th.AddEvent('click', function() {
			console.info('player selected:', players[this.player].name);
			// TODO
		});
	}
	for (var q = 0; q < questions.length; ++q) {
		tr = table.AddElement('tr');
		var header = tr.AddElement('th');
		header.title = questions[q].description;
		header.AddText(questions[q].tag);
		header.question = q;
		header.AddEvent('click', function() {
			console.info('question selected:', questions[this.question].tag);
			// TODO
		});
		for (var p = 0; p < players.length; ++p) {
			var td = tr.AddElement('td');
			if (questions[q].answers[p] === undefined)
				td.style.background = '#f0f';
			else if (questions[q].answers[p] === null)
				td.style.background = 'grey';
			else if (questions[q].answers[p].answer.text !== undefined) {
				td.AddText(questions[q].answers[p].answer.text);
				if (questions[q].answers[p].style !== null)
					td.style.background = questions[q].answers[p].style;
			}
			else
				td.style.background = 'cyan';
		}
	}
} // }}}

function show_player(player, questions, answers) { // {{{
	contents.ClearAll();
	console.info('show player', player, questions, answers);
	// TODO
} // }}}

function show_question(question, data) { // {{{
	contents.ClearAll();
	console.info('show question', question, data);
	// TODO
} // }}}

// vim: set foldmethod=marker :
