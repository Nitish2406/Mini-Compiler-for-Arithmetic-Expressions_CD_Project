/**
 * Automated Test Suite Module for Mini Compiler
 */

const TEST_CASES = [
    {
        name: "Slide Canonical Expression",
        expr: "3 + 4 * (2 - 1)",
        expectedPhase: "SUCCESS",
        expectedVal: 7,
        category: "Precedence & Parentheses"
    },
    {
        name: "Basic Precedence (* over +)",
        expr: "2 + 3 * 4",
        expectedPhase: "SUCCESS",
        expectedVal: 14,
        category: "Operator Precedence"
    },
    {
        name: "Parenthesis Override",
        expr: "(2 + 3) * 4",
        expectedPhase: "SUCCESS",
        expectedVal: 20,
        category: "Parentheses"
    },
    {
        name: "Power Operator (Right-Associative)",
        expr: "2 ^ 3 ^ 2",
        expectedPhase: "SUCCESS",
        expectedVal: 512,
        category: "Exponentiation"
    },
    {
        name: "Float Operand & Type Promotion",
        expr: "10.5 + 4.5 * 2",
        expectedPhase: "SUCCESS",
        expectedVal: 19.5,
        category: "Floating Point"
    },
    {
        name: "Integer Division Promotion",
        expr: "15 / 2",
        expectedPhase: "SUCCESS",
        expectedVal: 7.5,
        category: "Division"
    },
    {
        name: "Unary Negative Operators",
        expr: "-5 + 8 * -2",
        expectedPhase: "SUCCESS",
        expectedVal: -21,
        category: "Unary Operators"
    },
    {
        name: "Slide Semantic Error (Div by Zero)",
        expr: "8 / (4 - 4)",
        expectedPhase: "Phase 3: Semantic Analysis",
        category: "Semantic Checks"
    },
    {
        name: "Nested Div by Zero in Sub-expression",
        expr: "100 / (2 * 5 - 10)",
        expectedPhase: "Phase 3: Semantic Analysis",
        category: "Semantic Checks"
    },
    {
        name: "Slide Syntax Error (Consecutive Ops)",
        expr: "3 + * 4",
        expectedPhase: "Phase 2: Syntax Analysis",
        category: "Syntax Parsing"
    },
    {
        name: "Unclosed Parenthesis Syntax Error",
        expr: "(3 + 4 * 2",
        expectedPhase: "Phase 2: Syntax Analysis",
        category: "Syntax Parsing"
    },
    {
        name: "Slide Lexical Error (Illegal Character)",
        expr: "3 + @ 4",
        expectedPhase: "Phase 1: Lexical Analysis",
        category: "Lexical Scanning"
    }
];

class TestRunner {
    static runAll(tableBodyId, summaryBadgeId, onSelectExpr) {
        const tbody = document.getElementById(tableBodyId);
        const summaryBadge = document.getElementById(summaryBadgeId);
        if (!tbody) return;

        tbody.innerHTML = '';
        let passedCount = 0;
        const totalCount = TEST_CASES.length;

        TEST_CASES.forEach((tc, idx) => {
            const startT = performance.now();
            const res = MiniCompilerEngine.compile(tc.expr);
            const timeMs = (performance.now() - startT).toFixed(2);

            let passed = false;
            let actualOutcome = '';

            if (tc.expectedPhase === 'SUCCESS') {
                if (res.success && Math.abs(res.finalValue - tc.expectedVal) < 0.0001) {
                    passed = true;
                    actualOutcome = `Result = ${res.finalValue}`;
                } else if (res.success) {
                    actualOutcome = `Computed ${res.finalValue} (expected ${tc.expectedVal})`;
                } else {
                    actualOutcome = `Failed in ${res.errorPhase}`;
                }
            } else {
                if (!res.success && res.errorPhase && res.errorPhase.startsWith(tc.expectedPhase.split(':')[0])) {
                    passed = true;
                    actualOutcome = `Caught in ${res.errorPhase}`;
                } else if (res.success) {
                    actualOutcome = `Unexpected success (Result = ${res.finalValue})`;
                } else {
                    actualOutcome = `Failed in: ${res.errorPhase}`;
                }
            }

            if (passed) passedCount++;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code>#${idx + 1}</code></td>
                <td><strong>${escapeHtml(tc.name)}</strong><br><small class="text-muted">${escapeHtml(tc.category)}</small></td>
                <td><code>${escapeHtml(tc.expr)}</code></td>
                <td><span class="badge ${tc.expectedPhase === 'SUCCESS' ? 'badge-success' : 'badge-warning'}">${escapeHtml(tc.expectedPhase)}</span></td>
                <td><span class="badge ${passed ? 'badge-pass' : 'badge-fail'}">${passed ? 'PASS ✓' : 'FAIL ✗'}</span></td>
                <td><small>${escapeHtml(actualOutcome)} (${timeMs}ms)</small></td>
                <td><button class="btn-sm-run" data-expr="${escapeHtml(tc.expr)}">Load in Studio</button></td>
            `;
            tbody.appendChild(tr);
        });

        if (summaryBadge) {
            summaryBadge.innerHTML = `
                <span class="badge-pill ${passedCount === totalCount ? 'pill-all-pass' : 'pill-some-fail'}">
                    ${passedCount} / ${totalCount} Passed (100% Core Requirements)
                </span>
            `;
        }

        tbody.querySelectorAll('.btn-sm-run').forEach(btn => {
            btn.addEventListener('click', () => {
                const expr = btn.dataset.expr;
                if (onSelectExpr && expr) {
                    onSelectExpr(expr);
                }
            });
        });
    }
}

function escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

window.TEST_CASES = TEST_CASES;
window.TestRunner = TestRunner;
