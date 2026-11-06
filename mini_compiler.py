"""
Mini Compiler for Arithmetic Expressions
Created by:
 - Nitish
 - Teja
 - Gagan
"""

import sys
import json
from dataclasses import dataclass
from typing import List, Optional, Any, Dict, Tuple

# ==========================================
# PHASE 1: LEXICAL ANALYSIS (LEXER)
# ==========================================

class TokenType:
    NUMBER = "NUMBER"
    PLUS = "PLUS"
    MINUS = "MINUS"
    MULTIPLY = "MULTIPLY"
    DIVIDE = "DIVIDE"
    POWER = "POWER"
    LPAREN = "LPAREN"
    RPAREN = "RPAREN"
    EOF = "EOF"

@dataclass
class Token:
    type: str
    value: Any
    lexeme: str
    position: int

    def to_dict(self):
        return {
            "type": self.type,
            "value": self.value,
            "lexeme": self.lexeme,
            "position": self.position
        }

class LexicalError(Exception):
    def __init__(self, message: str, position: int, char: str):
        super().__init__(message)
        self.message = message
        self.position = position
        self.char = char

class Lexer:
    def __init__(self, text: str):
        self.text = text
        self.pos = 0
        self.current_char = self.text[0] if text else None

    def advance(self):
        self.pos += 1
        if self.pos < len(self.text):
            self.current_char = self.text[self.pos]
        else:
            self.current_char = None

    def peek(self) -> Optional[str]:
        peek_pos = self.pos + 1
        if peek_pos < len(self.text):
            return self.text[peek_pos]
        return None

    def skip_whitespace(self):
        while self.current_char is not None and self.current_char.isspace():
            self.advance()

    def number(self) -> Token:
        start_pos = self.pos
        result_str = ''
        is_float = False

        while self.current_char is not None and (self.current_char.isdigit() or self.current_char == '.'):
            if self.current_char == '.':
                if is_float:
                    raise LexicalError(f"Malformed number with multiple decimal points at position {self.pos}", self.pos, '.')
                is_float = True
            result_str += self.current_char
            self.advance()

        val = float(result_str) if is_float else int(result_str)
        return Token(TokenType.NUMBER, val, result_str, start_pos)

    def tokenize(self) -> List[Token]:
        tokens = []
        while self.current_char is not None:
            if self.current_char.isspace():
                self.skip_whitespace()
                continue

            pos = self.pos
            ch = self.current_char

            if ch.isdigit() or (ch == '.' and self.peek() and self.peek().isdigit()):
                tokens.append(self.number())
                continue

            if ch == '+':
                tokens.append(Token(TokenType.PLUS, '+', '+', pos))
                self.advance()
            elif ch == '-':
                tokens.append(Token(TokenType.MINUS, '-', '-', pos))
                self.advance()
            elif ch == '*':
                tokens.append(Token(TokenType.MULTIPLY, '*', '*', pos))
                self.advance()
            elif ch == '/':
                tokens.append(Token(TokenType.DIVIDE, '/', '/', pos))
                self.advance()
            elif ch == '^':
                tokens.append(Token(TokenType.POWER, '^', '^', pos))
                self.advance()
            elif ch == '(':
                tokens.append(Token(TokenType.LPAREN, '(', '(', pos))
                self.advance()
            elif ch == ')':
                tokens.append(Token(TokenType.RPAREN, ')', ')', pos))
                self.advance()
            else:
                raise LexicalError(f"Illegal character '{ch}' at position {pos}", pos, ch)

        tokens.append(Token(TokenType.EOF, None, 'EOF', self.pos))
        return tokens


# ==========================================
# PHASE 2: SYNTAX ANALYSIS (PARSER & AST)
# ==========================================

class ASTNode:
    def to_dict(self):
        raise NotImplementedError

@dataclass
class NumberNode(ASTNode):
    value: Any
    num_type: str # 'int' or 'float'
    position: int

    def to_dict(self):
        return {
            "node_type": "NumberNode",
            "value": self.value,
            "type": self.num_type,
            "position": self.position
        }

@dataclass
class UnaryOpNode(ASTNode):
    op: Token
    operand: ASTNode

    def to_dict(self):
        return {
            "node_type": "UnaryOpNode",
            "operator": self.op.lexeme,
            "operand": self.operand.to_dict(),
            "position": self.op.position
        }

@dataclass
class BinaryOpNode(ASTNode):
    left: ASTNode
    op: Token
    right: ASTNode

    def to_dict(self):
        return {
            "node_type": "BinaryOpNode",
            "operator": self.op.lexeme,
            "left": self.left.to_dict(),
            "right": self.right.to_dict(),
            "position": self.op.position
        }

class SyntaxErrorCustom(Exception):
    def __init__(self, message: str, token: Token):
        super().__init__(message)
        self.message = message
        self.token = token

class Parser:
    """
    Grammar:
      expr   -> term ((PLUS | MINUS) term)*
      term   -> power ((MULTIPLY | DIVIDE) power)*
      power  -> factor (POWER factor)*   (or right associative: factor (POWER power)?)
      factor -> PLUS factor | MINUS factor | NUMBER | LPAREN expr RPAREN
    """
    def __init__(self, tokens: List[Token]):
        self.tokens = tokens
        self.pos = 0
        self.current_token = self.tokens[0] if tokens else None
        self.trace_logs = []

    def error(self, message: str):
        raise SyntaxErrorCustom(message, self.current_token)

    def advance(self):
        self.pos += 1
        if self.pos < len(self.tokens):
            self.current_token = self.tokens[self.pos]
        else:
            self.current_token = None

    def consume(self, token_type: str) -> Token:
        tok = self.current_token
        if tok.type == token_type:
            self.advance()
            return tok
        self.error(f"Expected token {token_type}, but found '{tok.lexeme}' ({tok.type}) at position {tok.position}")

    def factor(self) -> ASTNode:
        tok = self.current_token
        if tok.type == TokenType.PLUS:
            self.consume(TokenType.PLUS)
            node = self.factor()
            return UnaryOpNode(tok, node)
        elif tok.type == TokenType.MINUS:
            self.consume(TokenType.MINUS)
            node = self.factor()
            return UnaryOpNode(tok, node)
        elif tok.type == TokenType.NUMBER:
            self.consume(TokenType.NUMBER)
            num_type = "float" if isinstance(tok.value, float) else "int"
            return NumberNode(tok.value, num_type, tok.position)
        elif tok.type == TokenType.LPAREN:
            self.consume(TokenType.LPAREN)
            node = self.expr()
            if self.current_token.type != TokenType.RPAREN:
                self.error(f"Unmatched '(' - missing closing ')' near position {self.current_token.position}")
            self.consume(TokenType.RPAREN)
            return node
        else:
            self.error(f"Unexpected token '{tok.lexeme}' at position {tok.position}")

    def power(self) -> ASTNode:
        # Power operator (^) is typically right-associative: 2 ^ 3 ^ 2 = 2 ^ (3 ^ 2)
        node = self.factor()
        if self.current_token.type == TokenType.POWER:
            op = self.consume(TokenType.POWER)
            right = self.power()
            node = BinaryOpNode(node, op, right)
        return node

    def term(self) -> ASTNode:
        node = self.power()
        while self.current_token.type in (TokenType.MULTIPLY, TokenType.DIVIDE):
            op = self.current_token
            if op.type == TokenType.MULTIPLY:
                self.consume(TokenType.MULTIPLY)
            elif op.type == TokenType.DIVIDE:
                self.consume(TokenType.DIVIDE)
            node = BinaryOpNode(node, op, self.power())
        return node

    def expr(self) -> ASTNode:
        node = self.term()
        while self.current_token.type in (TokenType.PLUS, TokenType.MINUS):
            op = self.current_token
            if op.type == TokenType.PLUS:
                self.consume(TokenType.PLUS)
            elif op.type == TokenType.MINUS:
                self.consume(TokenType.MINUS)
            node = BinaryOpNode(node, op, self.term())
        return node

    def parse(self) -> ASTNode:
        if self.current_token.type == TokenType.EOF:
            self.error("Empty expression provided.")
        tree = self.expr()
        if self.current_token.type != TokenType.EOF:
            self.error(f"Unexpected token '{self.current_token.lexeme}' after expression at position {self.current_token.position}")
        return tree


# ==========================================
# PHASE 3: SEMANTIC ANALYSIS
# ==========================================

class SemanticError(Exception):
    def __init__(self, message: str, position: int):
        super().__init__(message)
        self.message = message
        self.position = position

class SemanticAnalyzer:
    """
    Checks:
    1. Operand type promotion (int vs float)
    2. Static division by zero detection
    3. Exponent validity
    """
    def __init__(self):
        self.warnings = []
        self.checks = []

    def analyze(self, node: ASTNode) -> Tuple[str, Any]:
        """
        Returns (inferred_type, static_evaluated_value_if_const)
        """
        if isinstance(node, NumberNode):
            self.checks.append(f"Number literal {node.value} validated as {node.num_type}.")
            return node.num_type, node.value

        elif isinstance(node, UnaryOpNode):
            operand_type, val = self.analyze(node.operand)
            computed_val = None
            if val is not None:
                computed_val = +val if node.op.type == TokenType.PLUS else -val
            self.checks.append(f"Unary operator '{node.op.lexeme}' applied on {operand_type} (value: {computed_val}).")
            return operand_type, computed_val

        elif isinstance(node, BinaryOpNode):
            left_type, left_val = self.analyze(node.left)
            right_type, right_val = self.analyze(node.right)

            op = node.op.lexeme

            # Check division by zero
            if op == '/':
                if right_val == 0:
                    raise SemanticError(
                        f"Semantic Error: Division by zero detected in sub-expression near position {node.op.position} ('{op}')",
                        node.op.position
                    )

            # Determine promoted type
            if op == '/':
                result_type = "float" # division results in float
            elif left_type == "float" or right_type == "float":
                result_type = "float"
            else:
                result_type = "int"

            computed_val = None
            if left_val is not None and right_val is not None:
                if op == '+':
                    computed_val = left_val + right_val
                elif op == '-':
                    computed_val = left_val - right_val
                elif op == '*':
                    computed_val = left_val * right_val
                elif op == '/':
                    computed_val = left_val / right_val
                elif op == '^':
                    computed_val = left_val ** right_val

            self.checks.append(
                f"Binary operator '{op}' validated: ({left_type}) {op} ({right_type}) -> promotes to {result_type}."
            )
            return result_type, computed_val

        raise SemanticError("Unknown AST node encountered during semantic analysis", 0)


# ==========================================
# PHASE 4: CODE GENERATION (TAC) & EXECUTION
# ==========================================

@dataclass
class Quadruple:
    op: str
    arg1: str
    arg2: Optional[str]
    result: str

    def to_dict(self):
        return {
            "op": self.op,
            "arg1": self.arg1,
            "arg2": self.arg2 if self.arg2 is not None else "",
            "result": self.result
        }

    def __str__(self):
        if self.arg2 is not None:
            return f"{self.result} = {self.arg1} {self.op} {self.arg2}"
        else:
            return f"{self.result} = {self.op}{self.arg1}"

class IntermediateCodeGen:
    def __init__(self):
        self.temp_counter = 1
        self.instructions: List[str] = []
        self.quadruples: List[Quadruple] = []

    def new_temp(self) -> str:
        temp = f"t{self.temp_counter}"
        self.temp_counter += 1
        return temp

    def generate(self, node: ASTNode) -> str:
        """
        Recursively translates AST to Three-Address Code and quadruples.
        Returns the variable/temporary/constant holding the node's result.
        """
        if isinstance(node, NumberNode):
            return str(node.value)

        elif isinstance(node, UnaryOpNode):
            operand_temp = self.generate(node.operand)
            temp = self.new_temp()
            quad = Quadruple(node.op.lexeme, operand_temp, None, temp)
            self.quadruples.append(quad)
            self.instructions.append(str(quad))
            return temp

        elif isinstance(node, BinaryOpNode):
            left_temp = self.generate(node.left)
            right_temp = self.generate(node.right)
            temp = self.new_temp()
            quad = Quadruple(node.op.lexeme, left_temp, right_temp, temp)
            self.quadruples.append(quad)
            self.instructions.append(str(quad))
            return temp

        raise ValueError("Invalid node for TAC generation")


class Executor:
    def __init__(self, quadruples: List[Quadruple]):
        self.quadruples = quadruples
        self.environment: Dict[str, Any] = {}
        self.execution_steps: List[Dict[str, Any]] = []

    def resolve(self, operand: str) -> Any:
        if operand in self.environment:
            return self.environment[operand]
        # Try parsing as number
        try:
            if '.' in operand:
                return float(operand)
            return int(operand)
        except ValueError:
            return float(operand)

    def execute(self) -> Tuple[Any, List[Dict[str, Any]]]:
        if not self.quadruples:
            return None, []

        for idx, quad in enumerate(self.quadruples):
            v1 = self.resolve(quad.arg1)
            v2 = self.resolve(quad.arg2) if quad.arg2 is not None and quad.arg2 != "" else None

            res_val = 0
            if quad.op == '+':
                res_val = v1 + v2
            elif quad.op == '-':
                if v2 is None: # unary
                    res_val = -v1
                else:
                    res_val = v1 - v2
            elif quad.op == '*':
                res_val = v1 * v2
            elif quad.op == '/':
                if v2 == 0:
                    raise ZeroDivisionError(f"Runtime Error: Division by zero when computing {quad.result} = {v1} / {v2}")
                res_val = v1 / v2
            elif quad.op == '^':
                res_val = v1 ** v2

            # Clean integer display if integer
            if isinstance(res_val, float) and res_val.is_integer():
                res_val = int(res_val)

            self.environment[quad.result] = res_val

            self.execution_steps.append({
                "step": idx + 1,
                "instruction": str(quad),
                "op": quad.op,
                "arg1_val": v1,
                "arg2_val": v2,
                "result_var": quad.result,
                "result_val": res_val,
                "registers": dict(self.environment)
            })

        last_quad = self.quadruples[-1]
        final_result = self.environment.get(last_quad.result)
        return final_result, self.execution_steps


# ==========================================
# UNIFIED COMPILER PIPELINE
# ==========================================

class MiniCompiler:
    def __init__(self):
        pass

    def compile(self, expression: str) -> Dict[str, Any]:
        result = {
            "input": expression,
            "success": False,
            "error": None,
            "error_phase": None,
            "tokens": [],
            "ast": None,
            "semantic_checks": [],
            "promoted_type": None,
            "tac": [],
            "quadruples": [],
            "final_value": None,
            "execution_steps": []
        }

        # Phase 1: Lexical Analysis
        try:
            lexer = Lexer(expression)
            tokens = lexer.tokenize()
            result["tokens"] = [t.to_dict() for t in tokens]
        except LexicalError as le:
            result["error"] = f"Lexical Error: {le.message}"
            result["error_phase"] = "Phase 1: Lexical Analysis"
            result["error_pos"] = le.position
            return result

        # Phase 2: Syntax Analysis
        try:
            parser = Parser(tokens)
            ast_root = parser.parse()
            result["ast"] = ast_root.to_dict()
        except SyntaxErrorCustom as se:
            result["error"] = f"Syntax Error: {se.message}"
            result["error_phase"] = "Phase 2: Syntax Analysis"
            result["error_pos"] = se.token.position if se.token else 0
            return result

        # Phase 3: Semantic Analysis
        try:
            analyzer = SemanticAnalyzer()
            res_type, const_val = analyzer.analyze(ast_root)
            result["semantic_checks"] = analyzer.checks
            result["promoted_type"] = res_type
        except SemanticError as sme:
            result["error"] = f"{sme.message}"
            result["error_phase"] = "Phase 3: Semantic Analysis"
            result["error_pos"] = sme.position
            return result

        # Phase 4: Intermediate Code Generation
        try:
            icg = IntermediateCodeGen()
            if isinstance(ast_root, NumberNode):
                # Simple number, generate assignment
                t = icg.new_temp()
                quad = Quadruple('=', str(ast_root.value), None, t)
                icg.quadruples.append(quad)
                icg.instructions.append(f"{t} = {ast_root.value}")
            else:
                icg.generate(ast_root)

            result["tac"] = icg.instructions
            result["quadruples"] = [q.to_dict() for q in icg.quadruples]
        except Exception as e:
            result["error"] = f"Code Generation Error: {str(e)}"
            result["error_phase"] = "Phase 4: Code Generation"
            return result

        # Execution
        try:
            executor = Executor(icg.quadruples)
            val, steps = executor.execute()
            result["final_value"] = val
            result["execution_steps"] = steps
            result["success"] = True
        except Exception as ee:
            result["error"] = f"Execution Error: {str(ee)}"
            result["error_phase"] = "Phase 4: Executor"
            return result

        return result


def main():
    compiler = MiniCompiler()
    test_expr = sys.argv[1] if len(sys.argv) > 1 else "3 + 4 * (2 - 1)"
    print(f"=== Mini Compiler for Arithmetic Expressions ===")
    print(f"Input: {test_expr}\n")

    res = compiler.compile(test_expr)

    if not res["success"]:
        print(f"FAILED in {res['error_phase']}")
        print(f"Error: {res['error']}")
        if "error_pos" in res and res["error_pos"] is not None:
            print(f"Position: {res['error_pos']}")
            print(test_expr)
            print(" " * res["error_pos"] + "^")
        return

    print("--- [Phase 1: Tokens] ---")
    for t in res["tokens"]:
        print(f"  {t['lexeme']:<10} -> {t['type']} (pos {t['position']})")

    print("\n--- [Phase 3: Semantic Checks] ---")
    for chk in res["semantic_checks"]:
        print(f"  ✓ {chk}")
    print(f"  Result Type: {res['promoted_type']}")

    print("\n--- [Phase 4: Three-Address Code (TAC)] ---")
    for line in res["tac"]:
        print(f"  {line}")

    print("\n--- [Quadruples] ---")
    print(f"  {'OP':<6} {'ARG1':<8} {'ARG2':<8} {'RESULT':<8}")
    for q in res["quadruples"]:
        print(f"  {q['op']:<6} {q['arg1']:<8} {q['arg2']:<8} {q['result']:<8}")

    print("\n--- [Execution Output] ---")
    for s in res["execution_steps"]:
        print(f"  Step {s['step']}: {s['instruction']}  =>  {s['result_var']} = {s['result_val']}")

    print(f"\nFinal Result = {res['final_value']}")

if __name__ == "__main__":
    main()
