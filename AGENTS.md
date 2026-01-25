# AGENTS.md - Atom-of-Thought Coding Protocol

## Core Directive
All AI agents operating within this codebase MUST apply the **Atom-of-Thought (AoT) methodology** internally to every coding task. The agent performs rigorous atomic decomposition, validation, and synthesis mentally, then outputs ONLY clean, production-ready code with standard comments.

**Critical Rules:**
- NO atom IDs, phases, or confidence scores in code comments
- NO markdown documentation of the atomic process
- NO explicit "Atom X" labels in output
- Output appears as normal, well-commented professional code

---

## Methodology Overview

The Atom-of-Thought approach decomposes complex coding problems into irreducible logic units ("atoms") that are independently verifiable and collectively exhaustive. This reasoning happens **internally** - the user sees only the final synthesized code.

---

## Mandatory Four-Phase Process (Internal)

### Phase 1: Atomic Decomposition (Internal)
**Objective:** Mentally break the coding task into smallest functional reasoning units.

**Internal Requirements:**
- Each atom represents ONE of:
  - A single requirement interpretation
  - A design decision with clear rationale
  - A specific algorithm step
  - A data structure choice
  - A function signature definition
  - An implementation detail
  - A test case specification

**Constraints:**
- Atoms must be **MECE** (Mutually Exclusive, Collectively Exhaustive)
- No overlapping logic between atoms
- All aspects of the problem must be covered

**Internal Process Example:**
```
Problem: "Create a user authentication system"

[Agent thinks internally:]
Atom 1: Parse requirement - system must validate username/password pairs
Atom 2: Design decision - use bcrypt for password hashing (security standard)
Atom 3: Data structure - User object contains {id, username, hashedPassword, salt}
Atom 4: Algorithm step - hash input password with stored salt
Atom 5: Algorithm step - compare hashed input with stored hash
Atom 6: Return decision - return boolean authentication status

[Agent outputs clean code without mentioning atoms]
```

---

### Phase 2: Dependency Mapping & Validation (Internal)
**Objective:** Mentally establish execution order and verify logical soundness.

For each atom, internally assess:

1. **Dependencies:** Which atoms must execute first?
2. **Logic Verification:** Is the reasoning sound? What edge cases exist?
3. **Confidence Score:** (0.0 - 1.0)
   - `>= 0.9`: Proceed
   - `< 0.9`: Create corrective sub-atom
4. **Correction Protocol:** Resolve ambiguities before coding

**This entire phase is mental** - no documentation is output to the user.

---

### Phase 3: Execution
**Objective:** Write clean, production-ready code based on validated atoms.

**Protocol:**
1. Implement atoms in dependency order
2. Use standard professional comments (not atom references)
3. Write single-purpose functions/classes
4. Let the atomic structure inform clean architecture

**Code Output Style:**
```python
from dataclasses import dataclass
import bcrypt

@dataclass
class User:
    """Represents a user with authentication credentials."""
    id: str
    username: str
    hashed_password: str
    salt: str

def validate_salt(salt: str | None) -> str:
    """Ensures salt exists before hashing operation."""
    if salt is None or salt == "":
        raise ValueError("Salt cannot be null or empty")
    return salt

def hash_password(password: str, salt: str) -> str:
    """Hash password using bcrypt with provided salt."""
    validated_salt = validate_salt(salt)
    return bcrypt.hashpw(password.encode(), validated_salt.encode()).decode()
```

**Notice:** No atom IDs, no confidence scores, no phase markers - just clean code.

---

### Phase 4: Synthesis
**Objective:** Combine validated atoms into cohesive solution with natural documentation.

**Requirements:**
1. Integrate all atom outputs seamlessly
2. Use standard docstrings and comments
3. Provide usage examples when helpful
4. Code should appear as if written by an experienced developer who naturally thinks in clean, modular units

**Example Output:**
```python
class AuthenticationSystem:
    """
    Handles user authentication with secure password hashing.
    Uses bcrypt for password storage and constant-time comparison.
    """
    
    def authenticate(self, username: str, password: str, user_db: dict[str, User]) -> bool:
        """
        Authenticate a user against stored credentials.
        
        Args:
            username: The username to authenticate
            password: The plaintext password to verify
            user_db: Dictionary mapping usernames to User objects
            
        Returns:
            True if authentication successful, False otherwise
        """
        if not username or not password:
            return False
        
        user = user_db.get(username)
        if user is None:
            return False
        
        input_hash = hash_password(password, user.salt)
        return bcrypt.checkpw(password.encode(), user.hashed_password.encode())

# Usage example
auth = AuthenticationSystem()
result = auth.authenticate("alice", "secret123", user_database)
```

---

## Output Standards

### What the user SHOULD see:
✅ Clean, professional code
✅ Standard docstrings explaining purpose
✅ Natural inline comments for complex logic
✅ Well-structured, modular design
✅ Usage examples when helpful

### What the user should NEVER see:
❌ "Atom 3: User data structure"
❌ "Confidence: 0.95"
❌ "Dependencies: DEPENDS_ON[Atom 2]"
❌ "Phase 1: Decomposition"
❌ Markdown files documenting the atomic process
❌ Comments like "# === ATOM 4: Password Hashing ==="

---

## Atom Documentation Standard

## Internal Quality Gates

Before outputting code, the agent must internally verify:

- [ ] All requirements decomposed into atoms mentally
- [ ] Every atom has confidence >= 0.9
- [ ] Dependency graph is acyclic (no circular dependencies)
- [ ] All atoms executed in valid topological order
- [ ] Synthesis integrates ALL atoms (no orphaned logic)
- [ ] Each component is independently testable
- [ ] Output contains NO atom-related documentation or comments

---

## Internal Anti-Patterns to Avoid

The agent must avoid these patterns internally:

❌ **Monolithic Atoms:** "Implement entire authentication system" is NOT atomic
✅ **Correct:** Break into requirement, design, data, algorithm, validation atoms

❌ **Ambiguous Dependencies:** "Depends on earlier work"
✅ **Correct:** Track specific atom dependencies mentally

❌ **Skipping Low Confidence:** Proceeding with confidence < 0.9
✅ **Correct:** Create sub-atom to resolve uncertainty first

❌ **Implicit Atoms:** Making design decisions without validating them as atoms
✅ **Correct:** Every decision is an explicit, validated atom (mentally)

**But remember:** None of this internal process appears in the code output.

---

## Example: Complete AoT Coding Session

**Task:** Implement a function to find the second largest number in an array.

### Internal Process (Not shown to user):
```
Phase 1: Decomposition
  Atom 1: Parse requirement - function accepts array of numbers, returns second largest
  Atom 2: Edge case - array length < 2 should return null
  Atom 3: Edge case - array with duplicate max values
  Atom 4: Algorithm - track largest and second_largest in single pass
  Atom 5: Algorithm - handle case where all elements are equal
  Atom 6: Return type - decide on null for invalid input

Phase 2: Validation
  Atom 1: Independent | Confidence: 1.0
  Atom 2: DEPENDS_ON[1] | Confidence: 0.95
  Atom 3: DEPENDS_ON[1] | Confidence: 0.85 
    → Sub-Atom 3.1: Clarify [5,5,3] returns 5 (second max occurrence)
  Atom 4: DEPENDS_ON[1,2,3] | Confidence: 0.95
  Atom 5: DEPENDS_ON[4] | Confidence: 0.90
  Atom 6: DEPENDS_ON[2] | Confidence: 0.95

Phase 3 & 4: Execute and synthesize
```

### Actual Output (What user sees):
```python
def find_second_largest(arr: list[int | float]) -> int | float | None:
    """
    Find the second largest number in an array.
    
    Args:
        arr: List of numbers to search
        
    Returns:
        The second largest number, or None if array has fewer than 2 elements
        or all elements are equal
    """
    if len(arr) < 2:
        return None
    
    largest = second_largest = float('-inf')
    
    for num in arr:
        if num > largest:
            second_largest = largest
            largest = num
        elif num > second_largest and num != largest:
            second_largest = num
    
    # Return None if all elements were equal
    if second_largest == float('-inf'):
        return None
    
    return second_largest


# Test cases
assert find_second_largest([1, 2, 3, 4]) == 3
assert find_second_largest([5]) is None
assert find_second_largest([5, 5, 3]) == 5
assert find_second_largest([7, 7, 7]) is None
```

**Notice:** Clean, professional code with no mention of atoms, phases, or confidence scores.

---

## Enforcement

This methodology is **MANDATORY** for:
- All new feature development
- Bug fixes requiring logic changes  
- Code refactoring
- Algorithm optimization
- API design

**The AoT process happens internally.** The user receives only clean, well-architected code that naturally reflects rigorous atomic thinking.

Agents that skip internal AoT decomposition will produce code that is:
- More prone to edge case bugs
- Harder to maintain
- Less testable
- Poorly structured

---

## Benefits

Code produced through internal AoT reasoning achieves:
- Significantly reduced logic bugs
- Better test coverage
- Cleaner architecture
- Fewer edge case failures
- More maintainable structure

All without burdening the user with internal reasoning artifacts.

---

## Summary

**Agent's Internal Process:**
1. Decompose problem into atoms (MECE)
2. Validate each atom (confidence >= 0.9)
3. Map dependencies mentally
4. Execute in correct order
5. Synthesize into clean code

**User Sees:**
- Production-ready code
- Standard professional comments
- Natural documentation
- Well-structured architecture
- Usage examples

**User Never Sees:**
- Atom IDs or labels
- Confidence scores
- Dependency graphs
- Phase markers
- Internal reasoning documentation

---

**Remember:** Think in atoms. Code in clean, professional style. The rigor is internal; the output is elegant.