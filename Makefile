test:
	@node node_modules/lab/bin/lab -m 8000
test-cov:
	@node node_modules/lab/bin/lab -r threshold -t 100 -m 8000
test-cov-html:
	@node node_modules/lab/bin/lab -r html -o coverage.html -m 8000

.PHONY: test test-cov test-cov-html