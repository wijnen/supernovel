all: basis.pdf reference.pdf

%.dvi: %.tex
	latex $<
	latex $<
	latex $<

%.pdf: %.dvi
	dvipdf $<
