/**
 * Visualizer for Mini Compiler
 * - AST Visualizer (Dynamic SVG Tree)
 * - Token Stream Renderer
 * - TAC Virtual Machine Step-by-Step Animator
 * - Source Error Pointer
 */

class ASTVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.zoomLevel = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
    }

    render(astRoot) {
        if (!this.container) return;
        this.container.innerHTML = '';

        if (!astRoot) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🌳</div>
                    <p>No Abstract Syntax Tree to display. Enter a valid expression and compile.</p>
                </div>
            `;
            return;
        }

        // Layout algorithm: Calculate sub-tree widths and positions
        const nodeWidth = 70;
        const nodeHeight = 55;
        const levelHeight = 85;
        const siblingGap = 24;

        function measureTree(node) {
            if (!node) return { width: 0, node: null };

            if (node.nodeType === 'NumberNode') {
                return {
                    node,
                    width: nodeWidth,
                    children: []
                };
            } else if (node.nodeType === 'UnaryOpNode') {
                const child = measureTree(node.operand);
                return {
                    node,
                    width: Math.max(nodeWidth, child.width),
                    children: [child]
                };
            } else if (node.nodeType === 'BinaryOpNode') {
                const leftChild = measureTree(node.left);
                const rightChild = measureTree(node.right);
                const totalWidth = Math.max(nodeWidth, leftChild.width + rightChild.width + siblingGap);
                return {
                    node,
                    width: totalWidth,
                    children: [leftChild, rightChild]
                };
            }
            return { node, width: nodeWidth, children: [] };
        }

        const measuredRoot = measureTree(astRoot);

        // Assign (x, y) coordinates
        const layoutNodes = [];
        const layoutEdges = [];

        function assignPositions(measured, xLeft, y, parentPos = null) {
            const currentX = xLeft + measured.width / 2;
            const currentY = y;

            layoutNodes.push({
                data: measured.node,
                x: currentX,
                y: currentY
            });

            if (parentPos) {
                layoutEdges.push({
                    x1: parentPos.x,
                    y1: parentPos.y + nodeHeight / 2,
                    x2: currentX,
                    y2: currentY - nodeHeight / 2
                });
            }

            if (measured.children.length === 1) {
                assignPositions(measured.children[0], xLeft + (measured.width - measured.children[0].width) / 2, y + levelHeight, { x: currentX, y: currentY });
            } else if (measured.children.length === 2) {
                const leftChild = measured.children[0];
                const rightChild = measured.children[1];
                const leftX = xLeft;
                const rightX = xLeft + leftChild.width + siblingGap;

                assignPositions(leftChild, leftX, y + levelHeight, { x: currentX, y: currentY });
                assignPositions(rightChild, rightX, y + levelHeight, { x: currentX, y: currentY });
            }
        }

        assignPositions(measuredRoot, 40, 50);

        // Compute SVG bounding dimensions
        let maxX = 0;
        let maxY = 0;
        layoutNodes.forEach(n => {
            if (n.x > maxX) maxX = n.x;
            if (n.y > maxY) maxY = n.y;
        });

        const svgWidth = Math.max(maxX + 80, 500);
        const svgHeight = Math.max(maxY + 80, 320);

        // Build SVG with responsive viewBox
        let svgHtml = `
            <div class="ast-toolbar">
                <button class="btn-tool" id="ast-zoom-in" title="Zoom In"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
                <button class="btn-tool" id="ast-zoom-out" title="Zoom Out"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
                <button class="btn-tool" id="ast-reset" title="Reset View"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg></button>
                <span class="ast-scale-badge" id="ast-scale-badge">100%</span>
            </div>
            <div class="ast-viewport" id="ast-viewport">
                <svg id="ast-svg" width="100%" height="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <linearGradient id="grad-operator" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#8b5cf6" />
                            <stop offset="100%" stop-color="#6366f1" />
                        </linearGradient>
                        <linearGradient id="grad-number" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#10b981" />
                            <stop offset="100%" stop-color="#059669" />
                        </linearGradient>
                        <linearGradient id="grad-edge" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#64748b" />
                            <stop offset="100%" stop-color="#94a3b8" />
                        </linearGradient>
                        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.25"/>
                        </filter>
                    </defs>
                    <g id="ast-canvas-group">
        `;

        // Render edges with smooth cubic bezier curve
        layoutEdges.forEach(edge => {
            const dy = (edge.y2 - edge.y1) * 0.5;
            const pathD = `M ${edge.x1} ${edge.y1} C ${edge.x1} ${edge.y1 + dy}, ${edge.x2} ${edge.y2 - dy}, ${edge.x2} ${edge.y2}`;
            svgHtml += `
                <path d="${pathD}" class="ast-tree-edge" />
            `;
        });

        // Render nodes
        layoutNodes.forEach(item => {
            const node = item.data;
            const isOp = node.nodeType === 'BinaryOpNode' || node.nodeType === 'UnaryOpNode';
            const label = isOp ? node.operator : String(node.value);
            const subLabel = isOp ? (node.nodeType === 'UnaryOpNode' ? 'UNARY' : 'OP') : (node.numType ? node.numType.toUpperCase() : 'NUM');
            const fillClass = isOp ? 'node-op' : 'node-num';

            svgHtml += `
                <g class="ast-node-group" transform="translate(${item.x}, ${item.y})" data-node-type="${node.nodeType}" data-label="${label}" data-pos="${node.position}">
                    <rect x="-32" y="-22" width="64" height="44" rx="12" class="ast-node-box ${fillClass}" filter="url(#shadow)" />
                    <text x="0" y="-3" text-anchor="middle" class="ast-node-text">${label}</text>
                    <text x="0" y="13" text-anchor="middle" class="ast-node-sub">${subLabel}</text>
                </g>
            `;
        });

        svgHtml += `
                    </g>
                </svg>
            </div>
        `;

        this.container.innerHTML = svgHtml;
        this.setupInteractivity(svgWidth, svgHeight);
    }

    setupInteractivity(initialW, initialH) {
        const viewport = document.getElementById('ast-viewport');
        const group = document.getElementById('ast-canvas-group');
        const badge = document.getElementById('ast-scale-badge');
        if (!viewport || !group) return;

        this.zoomLevel = 1.0;
        this.panX = 0;
        this.panY = 0;

        const updateTransform = () => {
            group.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.zoomLevel})`);
            if (badge) badge.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        };

        const zoomInBtn = document.getElementById('ast-zoom-in');
        const zoomOutBtn = document.getElementById('ast-zoom-out');
        const resetBtn = document.getElementById('ast-reset');

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                this.zoomLevel = Math.min(2.2, this.zoomLevel + 0.15);
                updateTransform();
            });
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                this.zoomLevel = Math.max(0.4, this.zoomLevel - 0.15);
                updateTransform();
            });
        }
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.zoomLevel = 1.0;
                this.panX = 0;
                this.panY = 0;
                updateTransform();
            });
        }

        // Mouse drag for panning
        viewport.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.startX = e.clientX - this.panX;
            this.startY = e.clientY - this.panY;
            viewport.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.panX = e.clientX - this.startX;
            this.panY = e.clientY - this.startY;
            updateTransform();
        });

        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                viewport.style.cursor = 'grab';
            }
        });

        // Wheel zoom
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            this.zoomLevel = Math.max(0.4, Math.min(2.2, this.zoomLevel + delta));
            updateTransform();
        }, { passive: false });
    }
}

// ==========================================
// TOKEN STREAM RENDERER
// ==========================================

class TokenStreamRenderer {
    static renderTokens(tokens, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        if (!tokens || tokens.length === 0) {
            container.innerHTML = '<p class="empty-text">No tokens generated.</p>';
            return;
        }

        const chipsWrapper = document.createElement('div');
        chipsWrapper.className = 'token-chips-container';

        tokens.forEach((tok, index) => {
            const chip = document.createElement('div');
            chip.className = `token-chip chip-${tok.type.toLowerCase()}`;
            chip.title = `Token #${index} | Type: ${tok.type} | Pos: ${tok.position}`;

            let typeIcon = '#';
            if (tok.type === 'NUMBER') typeIcon = '123';
            else if (['PLUS', 'MINUS', 'MULTIPLY', 'DIVIDE', 'POWER'].includes(tok.type)) typeIcon = '±';
            else if (['LPAREN', 'RPAREN'].includes(tok.type)) typeIcon = '( )';
            else if (tok.type === 'EOF') typeIcon = '⏏';

            chip.innerHTML = `
                <span class="chip-icon">${typeIcon}</span>
                <span class="chip-val">${tok.lexeme}</span>
                <span class="chip-tag">${tok.type}</span>
            `;
            chipsWrapper.appendChild(chip);
        });

        container.appendChild(chipsWrapper);
    }

    static renderTokenTable(tokens, tableBodyId) {
        const tbody = document.getElementById(tableBodyId);
        if (!tbody) return;
        tbody.innerHTML = '';

        tokens.forEach((tok, index) => {
            const tr = document.createElement('tr');
            const endPos = tok.position + (tok.lexeme ? tok.lexeme.length - 1 : 0);
            tr.innerHTML = `
                <td><code>#${index}</code></td>
                <td><strong class="token-lexeme">${tok.lexeme}</strong></td>
                <td><span class="badge badge-${tok.type.toLowerCase()}">${tok.type}</span></td>
                <td><code>${tok.value !== null ? tok.value : '—'}</code></td>
                <td><span>Col ${tok.position} &rarr; ${endPos}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// ==========================================
// TAC VIRTUAL MACHINE ANIMATOR
// ==========================================

class TACVirtualMachine {
    constructor(executionSteps, containerId, registersContainerId) {
        this.steps = executionSteps || [];
        this.container = document.getElementById(containerId);
        this.regContainer = document.getElementById(registersContainerId);
        this.currentStepIdx = -1;
        this.isPlaying = false;
        this.timer = null;
        this.speedMs = 900;
    }

    init() {
        this.currentStepIdx = -1;
        this.pause();
        this.renderInstructionsList();
        this.renderRegisters({});
    }

    renderInstructionsList() {
        if (!this.container) return;
        this.container.innerHTML = '';

        if (this.steps.length === 0) {
            this.container.innerHTML = '<div class="empty-state"><p>No intermediate code to execute.</p></div>';
            return;
        }

        const list = document.createElement('div');
        list.className = 'tac-code-list';

        this.steps.forEach((step, idx) => {
            const row = document.createElement('div');
            row.className = 'tac-code-row';
            row.id = `tac-step-${idx}`;
            row.innerHTML = `
                <span class="tac-step-num">Step ${step.step}</span>
                <span class="tac-step-inst"><code>${step.instruction}</code></span>
                <span class="tac-step-result" id="tac-res-${idx}"></span>
            `;
            list.appendChild(row);
        });

        this.container.appendChild(list);
    }

    renderRegisters(registers) {
        if (!this.regContainer) return;
        this.regContainer.innerHTML = '';

        const keys = Object.keys(registers);
        if (keys.length === 0) {
            this.regContainer.innerHTML = '<div class="empty-regs">Memory / Registers: Empty</div>';
            return;
        }

        keys.forEach(key => {
            const regCard = document.createElement('div');
            regCard.className = 'reg-card';
            regCard.innerHTML = `
                <span class="reg-name">${key}</span>
                <span class="reg-val">${registers[key]}</span>
            `;
            this.regContainer.appendChild(regCard);
        });
    }

    goToStep(index) {
        if (this.steps.length === 0) return;
        this.currentStepIdx = Math.max(-1, Math.min(index, this.steps.length - 1));

        // Update instruction highlighting
        this.steps.forEach((_, idx) => {
            const row = document.getElementById(`tac-step-${idx}`);
            const resSpan = document.getElementById(`tac-res-${idx}`);
            if (row) {
                row.classList.remove('active', 'completed');
                if (idx < this.currentStepIdx) {
                    row.classList.add('completed');
                    if (resSpan) resSpan.textContent = `✓ ${this.steps[idx].resultVar} = ${this.steps[idx].resultVal}`;
                } else if (idx === this.currentStepIdx) {
                    row.classList.add('active');
                    if (resSpan) resSpan.textContent = `▶ ${this.steps[idx].resultVar} = ${this.steps[idx].resultVal}`;
                } else {
                    if (resSpan) resSpan.textContent = '';
                }
            }
        });

        // Update registers
        if (this.currentStepIdx >= 0) {
            this.renderRegisters(this.steps[this.currentStepIdx].registers);
        } else {
            this.renderRegisters({});
        }

        // Update step counter display if exists
        const counter = document.getElementById('vm-step-counter');
        if (counter) {
            counter.textContent = `${this.currentStepIdx + 1} / ${this.steps.length}`;
        }
    }

    next() {
        if (this.currentStepIdx < this.steps.length - 1) {
            this.goToStep(this.currentStepIdx + 1);
            return true;
        } else {
            this.pause();
            return false;
        }
    }

    prev() {
        if (this.currentStepIdx > 0) {
            this.goToStep(this.currentStepIdx - 1);
        } else {
            this.goToStep(-1);
        }
    }

    reset() {
        this.pause();
        this.goToStep(-1);
    }

    play() {
        if (this.isPlaying) return;
        this.isPlaying = true;

        if (this.currentStepIdx >= this.steps.length - 1) {
            this.goToStep(-1);
        }

        const playBtn = document.getElementById('vm-play-btn');
        if (playBtn) playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pause';

        this.timer = setInterval(() => {
            const hasMore = this.next();
            if (!hasMore) {
                this.pause();
            }
        }, this.speedMs);
    }

    pause() {
        this.isPlaying = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        const playBtn = document.getElementById('vm-play-btn');
        if (playBtn) playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Auto-Play';
    }

    setSpeed(ms) {
        this.speedMs = ms;
        if (this.isPlaying) {
            this.pause();
            this.play();
        }
    }
}

// Global visualizer instances
window.ASTVisualizer = ASTVisualizer;
window.TokenStreamRenderer = TokenStreamRenderer;
window.TACVirtualMachine = TACVirtualMachine;
