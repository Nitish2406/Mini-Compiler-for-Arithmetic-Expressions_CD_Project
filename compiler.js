/**
 * Mini Compiler for Arithmetic Expressions
 * Team Members:
 *   - Nitish
 *   - Teja
 *   - Gagan
 * 
 * 4 Phases:
 * 1. Lexical Analysis (Lexer)
 * 2. Syntax Analysis (Recursive Descent Parser & AST)
 * 3. Semantic Analysis (Type checking, Precedence, Div-by-Zero check)
 * 4. Intermediate Code Generation (TAC & Quadruples) + Virtual Machine Executor
 */

// ==========================================
// PHASE 1: LEXICAL ANALYSIS
// ==========================================

const TokenType = {
    NUMBER: 'NUMBER',
    PLUS: 'PLUS',
    MINUS: 'MINUS',
    MULTIPLY: 'MULTIPLY',
    DIVIDE: 'DIVIDE',
    POWER: 'POWER',
    LPAREN: 'LPAREN',
    RPAREN: 'RPAREN',
    EOF: 'EOF'
};

class Token {
    constructor(type, value, lexeme, position) {
        this.type = type;
        this.value = value;
        this.lexeme = lexeme;
        this.position = position;
        this.length = String(lexeme).length;
    }
}

class LexicalError extends Error {
    constructor(message, position, char) {
        super(message);
        this.name = 'LexicalError';
        this.position = position;
        this.char = char;
    }
}

class Lexer {
    constructor(input) {
        this.text = input || '';
        this.pos = 0;
        this.currentChar = this.text.length > 0 ? this.text[0] : null;
        this.logs = [];
    }

    advance() {
        this.pos++;
        if (this.pos < this.text.length) {
            this.currentChar = this.text[this.pos];
        } else {
            this.currentChar = null;
        }
    }

    peek() {
        const peekPos = this.pos + 1;
        if (peekPos < this.text.length) {
            return this.text[peekPos];
        }
        return null;
    }

    skipWhitespace() {
        while (this.currentChar !== null && /\s/.test(this.currentChar)) {
            this.advance();
        }
    }

    number() {
        const startPos = this.pos;
        let resultStr = '';
        let isFloat = false;

        while (this.currentChar !== null && (/\d/.test(this.currentChar) || this.currentChar === '.')) {
            if (this.currentChar === '.') {
                if (isFloat) {
                    throw new LexicalError(`Malformed number with multiple decimal points at position ${this.pos}`, this.pos, '.');
                }
                isFloat = true;
            }
            resultStr += this.currentChar;
            this.advance();
        }

        const numVal = isFloat ? parseFloat(resultStr) : parseInt(resultStr, 10);
        this.logs.push(`Scanned ${isFloat ? 'float' : 'integer'} literal '${resultStr}' at pos ${startPos}`);
        return new Token(TokenType.NUMBER, numVal, resultStr, startPos);
    }

    tokenize() {
        const tokens = [];
        this.logs = [];

        while (this.currentChar !== null) {
            if (/\s/.test(this.currentChar)) {
                this.skipWhitespace();
                continue;
            }

            const pos = this.pos;
            const ch = this.currentChar;

            if (/\d/.test(ch) || (ch === '.' && this.peek() && /\d/.test(this.peek()))) {
                tokens.push(this.number());
                continue;
            }

            switch (ch) {
                case '+':
                    tokens.push(new Token(TokenType.PLUS, '+', '+', pos));
                    this.logs.push(`Found operator PLUS '+' at pos ${pos}`);
                    this.advance();
                    break;
                case '-':
                    tokens.push(new Token(TokenType.MINUS, '-', '-', pos));
                    this.logs.push(`Found operator MINUS '-' at pos ${pos}`);
                    this.advance();
                    break;
                case '*':
                    tokens.push(new Token(TokenType.MULTIPLY, '*', '*', pos));
                    this.logs.push(`Found operator MULTIPLY '*' at pos ${pos}`);
                    this.advance();
                    break;
                case '/':
                    tokens.push(new Token(TokenType.DIVIDE, '/', '/', pos));
                    this.logs.push(`Found operator DIVIDE '/' at pos ${pos}`);
                    this.advance();
                    break;
                case '^':
                    tokens.push(new Token(TokenType.POWER, '^', '^', pos));
                    this.logs.push(`Found operator POWER '^' at pos ${pos}`);
                    this.advance();
                    break;
                case '(':
                    tokens.push(new Token(TokenType.LPAREN, '(', '(', pos));
                    this.logs.push(`Found delimiter LPAREN '(' at pos ${pos}`);
                    this.advance();
                    break;
                case ')':
                    tokens.push(new Token(TokenType.RPAREN, ')', ')', pos));
                    this.logs.push(`Found delimiter RPAREN ')' at pos ${pos}`);
                    this.advance();
                    break;
                default:
                    throw new LexicalError(`Illegal character '${ch}' at position ${pos}`, pos, ch);
            }
        }

        tokens.push(new Token(TokenType.EOF, null, 'EOF', this.pos));
        this.logs.push(`Appended EOF token at pos ${this.pos}`);
        return { tokens, logs: this.logs };
    }
}

// ==========================================
// PHASE 2: SYNTAX ANALYSIS (PARSER & AST)
// ==========================================

class ASTNode {
    constructor(nodeType) {
        this.nodeType = nodeType;
        this.id = 'node_' + Math.random().toString(36).substr(2, 9);
    }
}

class NumberNode extends ASTNode {
    constructor(value, numType, position) {
        super('NumberNode');
        this.value = value;
        this.numType = numType; // 'int' or 'float'
        this.position = position;
    }
}

class UnaryOpNode extends ASTNode {
    constructor(opToken, operand) {
        super('UnaryOpNode');
        this.operator = opToken.lexeme;
        this.opToken = opToken;
        this.operand = operand;
        this.position = opToken.position;
    }
}

class BinaryOpNode extends ASTNode {
    constructor(left, opToken, right) {
        super('BinaryOpNode');
        this.left = left;
        this.operator = opToken.lexeme;
        this.opToken = opToken;
        this.right = right;
        this.position = opToken.position;
    }
}

class SyntaxErrorCustom extends Error {
    constructor(message, token) {
        super(message);
        this.name = 'SyntaxError';
        this.token = token;
        this.position = token ? token.position : 0;
    }
}

class Parser {
    /**
     * Context-Free Grammar:
     *   Expr   -> Term (( '+' | '-' ) Term)*
     *   Term   -> Power (( '*' | '/' ) Power)*
     *   Power  -> Factor ( '^' Power )?      [Right-associative]
     *   Factor -> '+' Factor | '-' Factor | NUMBER | '(' Expr ')'
     */
    constructor(tokens) {
        this.tokens = tokens || [];
        this.pos = 0;
        this.currentToken = this.tokens.length > 0 ? this.tokens[0] : null;
        this.derivationSteps = [];
    }

    error(message) {
        throw new SyntaxErrorCustom(message, this.currentToken);
    }

    advance() {
        this.pos++;
        if (this.pos < this.tokens.length) {
            this.currentToken = this.tokens[this.pos];
        } else {
            this.currentToken = null;
        }
    }

    consume(tokenType) {
        const tok = this.currentToken;
        if (tok && tok.type === tokenType) {
            this.advance();
            return tok;
        }
        const found = tok ? `'${tok.lexeme}' (${tok.type})` : 'EOF';
        const pos = tok ? tok.position : 'end';
        this.error(`Syntax Error: Expected ${tokenType}, but found ${found} at position ${pos}`);
    }

    factor() {
        const tok = this.currentToken;
        this.derivationSteps.push(`Factor -> matching '${tok ? tok.lexeme : 'EOF'}'`);

        if (!tok) {
            this.error('Unexpected end of input while expecting an operand or factor');
        }

        if (tok.type === TokenType.PLUS) {
            this.consume(TokenType.PLUS);
            const operand = this.factor();
            return new UnaryOpNode(tok, operand);
        } else if (tok.type === TokenType.MINUS) {
            this.consume(TokenType.MINUS);
            const operand = this.factor();
            return new UnaryOpNode(tok, operand);
        } else if (tok.type === TokenType.NUMBER) {
            this.consume(TokenType.NUMBER);
            const numType = Number.isInteger(tok.value) ? 'int' : 'float';
            return new NumberNode(tok.value, numType, tok.position);
        } else if (tok.type === TokenType.LPAREN) {
            this.consume(TokenType.LPAREN);
            const node = this.expr();
            if (!this.currentToken || this.currentToken.type !== TokenType.RPAREN) {
                const errPos = this.currentToken ? this.currentToken.position : tok.position;
                this.error(`Unclosed parenthesis: missing ')' matching '(' at position ${tok.position}`);
            }
            this.consume(TokenType.RPAREN);
            return node;
        } else {
            this.error(`Unexpected token '${tok.lexeme}' near position ${tok.position}`);
        }
    }

    power() {
        let node = this.factor();
        if (this.currentToken && this.currentToken.type === TokenType.POWER) {
            const opTok = this.consume(TokenType.POWER);
            this.derivationSteps.push(`Power -> Factor '^' Power (Right-associative)`);
            const right = this.power();
            node = new BinaryOpNode(node, opTok, right);
        }
        return node;
    }

    term() {
        let node = this.power();
        while (this.currentToken && (this.currentToken.type === TokenType.MULTIPLY || this.currentToken.type === TokenType.DIVIDE)) {
            const opTok = this.currentToken;
            this.derivationSteps.push(`Term -> Power '${opTok.lexeme}' Power`);
            this.consume(opTok.type);
            const right = this.power();
            node = new BinaryOpNode(node, opTok, right);
        }
        return node;
    }

    expr() {
        let node = this.term();
        while (this.currentToken && (this.currentToken.type === TokenType.PLUS || this.currentToken.type === TokenType.MINUS)) {
            const opTok = this.currentToken;
            this.derivationSteps.push(`Expr -> Term '${opTok.lexeme}' Term`);
            this.consume(opTok.type);
            const right = this.term();
            node = new BinaryOpNode(node, opTok, right);
        }
        return node;
    }

    parse() {
        if (!this.currentToken || this.currentToken.type === TokenType.EOF) {
            this.error('Empty expression: please provide an arithmetic expression to compile.');
        }

        const astRoot = this.expr();

        if (this.currentToken && this.currentToken.type !== TokenType.EOF) {
            this.error(`Unexpected token '${this.currentToken.lexeme}' after valid expression at position ${this.currentToken.position}`);
        }

        return { ast: astRoot, derivationSteps: this.derivationSteps };
    }
}

// ==========================================
// PHASE 3: SEMANTIC ANALYSIS
// ==========================================

class SemanticError extends Error {
    constructor(message, position) {
        super(message);
        this.name = 'SemanticError';
        this.position = position;
    }
}

class SemanticAnalyzer {
    constructor() {
        this.checks = [];
        this.annotatedNodes = [];
    }

    analyze(node) {
        if (node instanceof NumberNode) {
            const info = {
                id: node.id,
                desc: `Literal value ${node.value} validated as ${node.numType}`,
                type: node.numType,
                constVal: node.value,
                isConst: true
            };
            this.checks.push(info.desc);
            this.annotatedNodes.push(info);
            return { type: node.numType, constVal: node.value };
        }

        if (node instanceof UnaryOpNode) {
            const operandResult = this.analyze(node.operand);
            let constVal = null;
            if (operandResult.constVal !== null) {
                constVal = node.operator === '+' ? +operandResult.constVal : -operandResult.constVal;
            }
            const info = {
                id: node.id,
                desc: `Unary '${node.operator}' on type '${operandResult.type}' evaluated statically to ${constVal}`,
                type: operandResult.type,
                constVal: constVal,
                isConst: true
            };
            this.checks.push(info.desc);
            this.annotatedNodes.push(info);
            return { type: operandResult.type, constVal };
        }

        if (node instanceof BinaryOpNode) {
            const leftRes = this.analyze(node.left);
            const rightRes = this.analyze(node.right);
            const op = node.operator;

            // Division by zero check
            if (op === '/') {
                if (rightRes.constVal === 0) {
                    throw new SemanticError(
                        `Semantic Error: Division by zero detected in sub-expression near position ${node.position} ('${op}')`,
                        node.position
                    );
                }
            }

            // Type promotion rule
            let promotedType = 'int';
            if (op === '/') {
                promotedType = 'float'; // division always yields float
            } else if (leftRes.type === 'float' || rightRes.type === 'float') {
                promotedType = 'float';
            } else {
                promotedType = 'int';
            }

            // Static sub-expression evaluation
            let constVal = null;
            if (leftRes.constVal !== null && rightRes.constVal !== null) {
                switch (op) {
                    case '+': constVal = leftRes.constVal + rightRes.constVal; break;
                    case '-': constVal = leftRes.constVal - rightRes.constVal; break;
                    case '*': constVal = leftRes.constVal * rightRes.constVal; break;
                    case '/': constVal = leftRes.constVal / rightRes.constVal; break;
                    case '^': constVal = Math.pow(leftRes.constVal, rightRes.constVal); break;
                }
            }

            const info = {
                id: node.id,
                desc: `Binary '${op}' validated: (${leftRes.type}) ${op} (${rightRes.type}) -> promotes to ${promotedType}`,
                type: promotedType,
                constVal: constVal,
                isConst: true
            };
            this.checks.push(info.desc);
            this.annotatedNodes.push(info);
            return { type: promotedType, constVal };
        }

        throw new SemanticError('Unknown AST node in semantic analysis', 0);
    }
}

// ==========================================
// PHASE 4: INTERMEDIATE CODE GENERATION & EXECUTION
// ==========================================

class Quadruple {
    constructor(op, arg1, arg2, result) {
        this.op = op;
        this.arg1 = String(arg1);
        this.arg2 = arg2 !== null && arg2 !== undefined ? String(arg2) : '';
        this.result = String(result);
    }

    toString() {
        if (this.arg2 !== '') {
            return `${this.result} = ${this.arg1} ${this.op} ${this.arg2}`;
        } else if (this.op === '=') {
            return `${this.result} = ${this.arg1}`;
        } else {
            return `${this.result} = ${this.op}${this.arg1}`;
        }
    }
}

class IntermediateCodeGen {
    constructor() {
        this.tempCounter = 1;
        this.instructions = [];
        this.quadruples = [];
    }

    newTemp() {
        const temp = `t${this.tempCounter}`;
        this.tempCounter++;
        return temp;
    }

    generate(node) {
        if (node instanceof NumberNode) {
            return String(node.value);
        }

        if (node instanceof UnaryOpNode) {
            const operandTemp = this.generate(node.operand);
            const temp = this.newTemp();
            const quad = new Quadruple(node.operator, operandTemp, null, temp);
            this.quadruples.push(quad);
            this.instructions.push(quad.toString());
            return temp;
        }

        if (node instanceof BinaryOpNode) {
            const leftTemp = this.generate(node.left);
            const rightTemp = this.generate(node.right);
            const temp = this.newTemp();
            const quad = new Quadruple(node.operator, leftTemp, rightTemp, temp);
            this.quadruples.push(quad);
            this.instructions.push(quad.toString());
            return temp;
        }

        throw new Error('Unknown AST node for code generation');
    }
}

class Executor {
    constructor(quadruples) {
        this.quadruples = quadruples || [];
        this.environment = {};
        this.executionSteps = [];
    }

    resolve(operand) {
        if (operand in this.environment) {
            return this.environment[operand];
        }
        if (operand.includes('.')) {
            return parseFloat(operand);
        }
        const parsed = parseInt(operand, 10);
        return isNaN(parsed) ? parseFloat(operand) : parsed;
    }

    execute() {
        if (this.quadruples.length === 0) {
            return { finalValue: null, steps: [] };
        }

        for (let idx = 0; idx < this.quadruples.length; idx++) {
            const quad = this.quadruples[idx];
            const v1 = this.resolve(quad.arg1);
            const v2 = quad.arg2 !== '' ? this.resolve(quad.arg2) : null;

            let resVal = 0;
            if (quad.op === '+') {
                resVal = v1 + v2;
            } else if (quad.op === '-') {
                resVal = v2 === null ? -v1 : v1 - v2;
            } else if (quad.op === '*') {
                resVal = v1 * v2;
            } else if (quad.op === '/') {
                if (v2 === 0) {
                    throw new Error(`Runtime Error: Division by zero at instruction ${quad.toString()}`);
                }
                resVal = v1 / v2;
            } else if (quad.op === '^') {
                resVal = Math.pow(v1, v2);
            } else if (quad.op === '=') {
                resVal = v1;
            }

            // Format nicely
            if (typeof resVal === 'number' && Number.isInteger(resVal)) {
                resVal = parseInt(resVal, 10);
            } else if (typeof resVal === 'number') {
                resVal = Math.round(resVal * 100000) / 100000;
            }

            this.environment[quad.result] = resVal;

            this.executionSteps.push({
                step: idx + 1,
                instruction: quad.toString(),
                op: quad.op,
                arg1Val: v1,
                arg2Val: v2,
                resultVar: quad.result,
                resultVal: resVal,
                registers: Object.assign({}, this.environment)
            });
        }

        const lastQuad = this.quadruples[this.quadruples.length - 1];
        const finalValue = this.environment[lastQuad.result];
        return { finalValue, steps: this.executionSteps };
    }
}

// ==========================================
// UNIFIED ENGINE WRAPPER
// ==========================================

class MiniCompilerEngine {
    static compile(inputExpression) {
        const result = {
            input: inputExpression,
            success: false,
            error: null,
            errorPhase: null,
            errorPosition: null,
            tokens: [],
            lexerLogs: [],
            ast: null,
            derivationSteps: [],
            semanticChecks: [],
            promotedType: null,
            tac: [],
            quadruples: [],
            finalValue: null,
            executionSteps: []
        };

        // Phase 1: Lexer
        try {
            const lexer = new Lexer(inputExpression);
            const lexResult = lexer.tokenize();
            result.tokens = lexResult.tokens;
            result.lexerLogs = lexResult.logs;
        } catch (e) {
            result.error = e.message;
            result.errorPhase = 'Phase 1: Lexical Analysis';
            result.errorPosition = e.position !== undefined ? e.position : 0;
            return result;
        }

        // Phase 2: Parser
        try {
            const parser = new Parser(result.tokens);
            const parseResult = parser.parse();
            result.ast = parseResult.ast;
            result.derivationSteps = parseResult.derivationSteps;
        } catch (e) {
            result.error = e.message;
            result.errorPhase = 'Phase 2: Syntax Analysis';
            result.errorPosition = e.position !== undefined ? e.position : 0;
            return result;
        }

        // Phase 3: Semantic Analyzer
        try {
            const semanticAnalyzer = new SemanticAnalyzer();
            const semResult = semanticAnalyzer.analyze(result.ast);
            result.semanticChecks = semanticAnalyzer.checks;
            result.promotedType = semResult.type;
        } catch (e) {
            result.error = e.message;
            result.errorPhase = 'Phase 3: Semantic Analysis';
            result.errorPosition = e.position !== undefined ? e.position : 0;
            return result;
        }

        // Phase 4: Intermediate Code Generation
        try {
            const icg = new IntermediateCodeGen();
            if (result.ast instanceof NumberNode) {
                const t = icg.newTemp();
                const quad = new Quadruple('=', result.ast.value, null, t);
                icg.quadruples.push(quad);
                icg.instructions.push(`${t} = ${result.ast.value}`);
            } else {
                icg.generate(result.ast);
            }
            result.tac = icg.instructions;
            result.quadruples = icg.quadruples;
        } catch (e) {
            result.error = `Code Generation Error: ${e.message}`;
            result.errorPhase = 'Phase 4: Intermediate Code Generation';
            return result;
        }

        // Execution (VM)
        try {
            const executor = new Executor(result.quadruples);
            const execResult = executor.execute();
            result.finalValue = execResult.finalValue;
            result.executionSteps = execResult.steps;
            result.success = true;
        } catch (e) {
            result.error = e.message;
            result.errorPhase = 'Phase 4: Execution / VM';
            return result;
        }

        return result;
    }
}

// Export for Node/CommonJS if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TokenType,
        Token,
        Lexer,
        Parser,
        SemanticAnalyzer,
        IntermediateCodeGen,
        Executor,
        MiniCompilerEngine
    };
}
