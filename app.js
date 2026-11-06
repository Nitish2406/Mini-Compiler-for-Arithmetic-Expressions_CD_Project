/**
 * Main Application Logic for Mini Compiler Web Studio
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const exprInput = document.getElementById('expr-input');
    const compileBtn = document.getElementById('btn-compile');
    const clearBtn = document.getElementById('btn-clear');
    const statusBanner = document.getElementById('status-banner');
    const errorBox = document.getElementById('error-box');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const presetChips = document.querySelectorAll('.preset-chip');

    // Visualizers
    const astViz = new ASTVisualizer('ast-container');
    let tacVm = null;
    let currentCompilation = null;

    // ==========================================
    // COMPILATION EXECUTION
    // ==========================================

    function runCompilation(expression) {
        const trimmed = expression.trim();
        if (!trimmed) {
            showError("Please enter an arithmetic expression.", "Phase 1: Lexical Analysis", 0, "");
            return;
        }

        const startTime = performance.now();
        const result = MiniCompilerEngine.compile(trimmed);
        const duration = (performance.now() - startTime).toFixed(2);
        currentCompilation = result;

        updatePipelineSteps(result);

        if (!result.success) {
            showError(result.error, result.errorPhase, result.errorPosition, trimmed);
            renderPartialOutputs(result);
        } else {
            hideError();
            showSuccess(result.finalValue, duration);
            renderFullOutputs(result);
        }
    }

    function updatePipelineSteps(result) {
        const steps = [
            { id: 'step-lex', phase: 'Phase 1: Lexical Analysis' },
            { id: 'step-parse', phase: 'Phase 2: Syntax Analysis' },
            { id: 'step-semantic', phase: 'Phase 3: Semantic Analysis' },
            { id: 'step-codegen', phase: 'Phase 4: Intermediate Code Generation' }
        ];

        let failedHit = false;

        steps.forEach(s => {
            const el = document.getElementById(s.id);
            if (!el) return;

            el.classList.remove('active', 'completed', 'failed');

            if (failedHit) {
                // not reached
            } else if (!result.success && result.errorPhase && result.errorPhase.startsWith(s.phase.split(':')[0])) {
                el.classList.add('failed');
                failedHit = true;
            } else {
                el.classList.add('completed');
            }
        });
    }

    function showError(message, phase, pos, rawExpr) {
        if (!errorBox) return;
        errorBox.classList.remove('hidden');

        let pointerVisual = '';
        if (rawExpr && pos !== undefined && pos !== null) {
            const safePos = Math.max(0, Math.min(pos, rawExpr.length));
            const caretLine = ' '.repeat(safePos) + '^';
            pointerVisual = `
                <div class="code-pointer-box">
                    <div class="code-line">${escapeHtml(rawExpr)}</div>
                    <div class="caret-line">${caretLine}</div>
                </div>
            `;
        }

        errorBox.innerHTML = `
            <div class="error-badge-row">
                <span class="error-pill">${phase || 'Compiler Error'}</span>
                ${pos !== undefined && pos !== null ? `<span class="pos-pill">Position ${pos}</span>` : ''}
            </div>
            <h4 class="error-heading">${escapeHtml(message)}</h4>
            ${pointerVisual}
            <p class="error-suggestion">${getSuggestion(phase, message)}</p>
        `;

        if (statusBanner) {
            statusBanner.className = 'status-banner banner-failed';
            statusBanner.innerHTML = `
                <div class="banner-icon">⚠️</div>
                <div class="banner-text">
                    <strong>Compilation Halted in ${escapeHtml(phase || 'Compiler')}</strong>
                    <span>Inspect error diagnostics below to fix your expression.</span>
                </div>
            `;
        }
    }

    function hideError() {
        if (errorBox) {
            errorBox.classList.add('hidden');
            errorBox.innerHTML = '';
        }
    }

    function showSuccess(finalValue, duration) {
        if (!statusBanner) return;
        statusBanner.className = 'status-banner banner-success';
        statusBanner.innerHTML = `
            <div class="banner-icon">✓</div>
            <div class="banner-text">
                <strong>Compilation &amp; Execution Succeeded!</strong>
                <span>All 4 phases completed in ${duration}ms. Final Result = <strong class="result-highlight">${finalValue}</strong></span>
            </div>
            <div class="banner-result-pill">Result: ${finalValue}</div>
        `;
    }

    function getSuggestion(phase, msg) {
        if (phase && phase.includes('Lexical')) {
            return "Suggestion: Remove unsupported characters (like @, #, $, letters). Only digits, decimals, +, -, *, /, ^, and parentheses are allowed.";
        }
        if (phase && phase.includes('Syntax')) {
            if (msg.includes('Unclosed parenthesis')) {
                return "Suggestion: Every opening parenthesis '(' must have a matching closing parenthesis ')'.";
            }
            return "Suggestion: Check for misplaced or adjacent operators (e.g. '3 + * 4'). Binary operators must have operands on both sides.";
        }
        if (phase && phase.includes('Semantic')) {
            return "Suggestion: Division by zero is mathematically undefined and strictly disallowed in semantic evaluation.";
        }
        return "Check expression syntax and try again.";
    }

    // ==========================================
    // RENDER OUTPUTS ACROSS TABS
    // ==========================================

    function renderPartialOutputs(result) {
        TokenStreamRenderer.renderTokens(result.tokens || [], 'overview-token-preview');
        TokenStreamRenderer.renderTokens(result.tokens || [], 'token-chips-view');
        TokenStreamRenderer.renderTokenTable(result.tokens || [], 'token-table-body');

        astViz.render(null);
        renderSemanticChecks([], null);
        renderTAC([], []);
        if (tacVm) tacVm.init();
    }

    function renderFullOutputs(result) {
        TokenStreamRenderer.renderTokens(result.tokens, 'overview-token-preview');
        TokenStreamRenderer.renderTokens(result.tokens, 'token-chips-view');
        TokenStreamRenderer.renderTokenTable(result.tokens, 'token-table-body');

        astViz.render(result.ast);
        renderDerivationLogs(result.derivationSteps);
        renderSemanticChecks(result.semanticChecks, result.promotedType);
        renderTAC(result.tac, result.quadruples);

        tacVm = new TACVirtualMachine(result.executionSteps, 'tac-vm-list', 'vm-registers-grid');
        tacVm.init();
        tacVm.goToStep(result.executionSteps.length - 1);

        highlightActivePrecedence(result.tokens);
    }

    function renderDerivationLogs(steps) {
        const container = document.getElementById('derivation-steps-log');
        if (!container) return;
        container.innerHTML = '';
        if (!steps || steps.length === 0) {
            container.innerHTML = '<li>No grammar derivation steps recorded.</li>';
            return;
        }
        steps.forEach(s => {
            const li = document.createElement('li');
            li.innerHTML = `<code>${escapeHtml(s)}</code>`;
            container.appendChild(li);
        });
    }

    function renderSemanticChecks(checks, promotedType) {
        const container = document.getElementById('semantic-checks-list');
        const badge = document.getElementById('promoted-type-badge');

        if (badge) {
            badge.textContent = promotedType ? `Result Inferred Type: ${promotedType.toUpperCase()}` : 'Type: —';
        }

        if (!container) return;
        container.innerHTML = '';

        if (!checks || checks.length === 0) {
            container.innerHTML = '<li class="empty-text">No semantic checks performed yet.</li>';
            return;
        }

        checks.forEach(chk => {
            const li = document.createElement('li');
            li.className = 'semantic-check-item';
            li.innerHTML = `<span class="check-icon">✓</span> <span>${escapeHtml(chk)}</span>`;
            container.appendChild(li);
        });
    }

    function renderTAC(tacList, quads) {
        const tacCodeBlock = document.getElementById('tac-code-block');
        const quadTableBody = document.getElementById('quadruples-table-body');

        if (tacCodeBlock) {
            tacCodeBlock.textContent = tacList.length === 0 ? '// Three-Address Code will appear here' : tacList.join('\n');
        }

        if (quadTableBody) {
            quadTableBody.innerHTML = '';
            if (quads.length === 0) {
                quadTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No quadruples generated</td></tr>';
                return;
            }
            quads.forEach(q => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span class="quad-op-badge">${escapeHtml(q.op)}</span></td>
                    <td><code>${escapeHtml(q.arg1)}</code></td>
                    <td><code>${escapeHtml(q.arg2 || '—')}</code></td>
                    <td><strong class="quad-res">${escapeHtml(q.result)}</strong></td>
                `;
                quadTableBody.appendChild(tr);
            });
        }
    }

    function highlightActivePrecedence(tokens) {
        const tableRows = document.querySelectorAll('#precedence-table tbody tr');
        const usedOps = new Set(tokens.map(t => t.lexeme));

        tableRows.forEach(row => {
            const opsText = row.dataset.ops || '';
            const opsArr = opsText.split(' ');
            const matched = opsArr.some(op => usedOps.has(op));
            row.classList.toggle('precedence-active', matched);
        });
    }

    // ==========================================
    // UI EVENT LISTENERS
    // ==========================================

    if (compileBtn && exprInput) {
        compileBtn.addEventListener('click', () => runCompilation(exprInput.value));
        exprInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') runCompilation(exprInput.value);
        });
    }

    if (clearBtn && exprInput) {
        clearBtn.addEventListener('click', () => {
            exprInput.value = '';
            exprInput.focus();
        });
    }

    presetChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const val = chip.dataset.expr;
            if (exprInput && val) {
                exprInput.value = val;
                runCompilation(val);
            }
        });
    });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetPane = document.getElementById(`tab-${targetTab}`);
            if (targetPane) targetPane.classList.add('active');
        });
    });

    // Virtual Machine Controls
    const vmNextBtn = document.getElementById('vm-step-next');
    const vmPrevBtn = document.getElementById('vm-step-prev');
    const vmPlayBtn = document.getElementById('vm-play-btn');
    const vmResetBtn = document.getElementById('vm-reset-btn');
    const vmSpeedSelect = document.getElementById('vm-speed-select');

    if (vmNextBtn) vmNextBtn.addEventListener('click', () => { if (tacVm) tacVm.next(); });
    if (vmPrevBtn) vmPrevBtn.addEventListener('click', () => { if (tacVm) tacVm.prev(); });
    if (vmPlayBtn) vmPlayBtn.addEventListener('click', () => {
        if (!tacVm) return;
        if (tacVm.isPlaying) tacVm.pause();
        else tacVm.play();
    });
    if (vmResetBtn) vmResetBtn.addEventListener('click', () => { if (tacVm) tacVm.reset(); });
    if (vmSpeedSelect) vmSpeedSelect.addEventListener('change', (e) => {
        if (tacVm) tacVm.setSpeed(parseInt(e.target.value, 10));
    });

    // Copy TAC Button
    const copyTacBtn = document.getElementById('btn-copy-tac');
    if (copyTacBtn) {
        copyTacBtn.addEventListener('click', () => {
            if (currentCompilation && currentCompilation.tac.length > 0) {
                navigator.clipboard.writeText(currentCompilation.tac.join('\n')).then(() => {
                    const originalText = copyTacBtn.innerHTML;
                    copyTacBtn.innerHTML = '✓ Copied!';
                    setTimeout(() => { copyTacBtn.innerHTML = originalText; }, 2000);
                });
            }
        });
    }

    // Automated Test Runner Integration
    const runTestsBtn = document.getElementById('btn-run-tests');
    function executeTestSuite() {
        if (window.TestRunner) {
            TestRunner.runAll('test-results-tbody', 'test-summary-badge', (expr) => {
                if (exprInput) {
                    exprInput.value = expr;
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    runCompilation(expr);
                }
            });
        }
    }
    if (runTestsBtn) runTestsBtn.addEventListener('click', executeTestSuite);

    // Theme Toggle
    const savedTheme = localStorage.getItem('mini_compiler_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'dark';
            const nextTheme = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('mini_compiler_theme', nextTheme);
            updateThemeIcon(nextTheme);
        });
    }

    function updateThemeIcon(theme) {
        if (!themeToggleBtn) return;
        themeToggleBtn.innerHTML = theme === 'dark' ? `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <span>Light</span>
        ` : `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            <span>Dark</span>
        `;
    }

    function escapeHtml(str) {
        if (typeof str !== 'string') return String(str);
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Initialize with canonical slide expression
    if (exprInput) {
        exprInput.value = "3 + 4 * (2 - 1)";
        runCompilation("3 + 4 * (2 - 1)");
    }
    executeTestSuite();
});
