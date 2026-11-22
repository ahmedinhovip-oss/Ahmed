#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "==> 8d-guru v0.2.1 skill integrity check"

errors=0
TOTAL_FILES=0

check_file() {
    TOTAL_FILES=$((TOTAL_FILES + 1))
    if [ -f "$1" ]; then
        echo "  ✅ $1"
    else
        echo "  ❌ MISSING: $1"
        errors=$((errors + 1))
    fi
}

check_min_size() {
    local file="$1"
    local min_bytes="$2"
    if [ -f "$file" ]; then
        local size
        size=$(wc -c < "$file" | tr -d ' ')
        if [ "$size" -ge "$min_bytes" ]; then
            echo "  ✅ $file (${size}B ≥ ${min_bytes}B)"
        else
            echo "  ❌ $file: ${size}B < ${min_bytes}B minimum"
            errors=$((errors + 1))
        fi
    fi
}

check_frontmatter() {
    if head -5 "$1" | grep -q "^---$"; then
        echo "  ✅ $1 (frontmatter ok)"
    else
        echo "  ❌ $1: missing or invalid YAML frontmatter"
        errors=$((errors + 1))
    fi
}

echo ""
echo "Core files..."
check_file "SKILL.md"
check_file "README.md"
check_file "LICENSE"
check_file "constraints.txt"
check_file "llms.txt"
check_file ".gitignore"

echo ""
echo "SKILL.md frontmatter..."
check_frontmatter "SKILL.md"

echo ""
echo "Docs..."
check_file "docs/AGENTS.md"
check_file "docs/INTAKE.md"
check_file "docs/gates.md"
check_file "docs/deliverables.md"

echo ""
echo "Methodology (D0-D8 + quality-methodologies) with size check (≥ 2KB)..."
for d in d0 d1 d2 d3 d4 d5 d6 d7 d8; do
    check_min_size "docs/methodology/${d}.md" 2048
done
check_min_size "docs/methodology/quality-methodologies.md" 5000

echo ""
echo "Prompts with size check (≥ 2000 bytes)..."
check_min_size "docs/prompts/intake.md" 2000

for d in d0 d1 d2 d3 d4 d5 d6 d7 d8; do
    case $d in
        d0) count=4 ;;
        d1) count=5 ;;
        d2) count=6 ;;
        d3) count=5 ;;
        d4) count=6 ;;
        d5) count=5 ;;
        d6) count=4 ;;
        d7) count=3 ;;
        d8) count=3 ;;
    esac
    for i in $(seq 1 $count); do
        check_min_size "docs/prompts/${d}-q${i}.md" 2000
    done
done

echo ""
echo "Example..."
check_min_size "docs/examples/usb-no-output.md" 3000

echo ""
# No-python check
echo "No-python check..."
py_files=$(find . -name "*.py" -not -path "./.git/*" 2>/dev/null | wc -l | tr -d ' ')
if [ "$py_files" -eq 0 ]; then
    echo "  ✅ No .py files found"
else
    echo "  ❌ Found $py_files .py file(s):"
    find . -name "*.py" -not -path "./.git/*"
    errors=$((errors + 1))
fi

if [ -f "pyproject.toml" ]; then
    echo "  ❌ pyproject.toml found"
    errors=$((errors + 1))
else
    echo "  ✅ No pyproject.toml"
fi

# S1-S5 structure check (spot-check key prompts)
echo ""
echo "S1-S5 structure spot-check..."
for prompt in docs/prompts/d4-q3.md docs/prompts/d2-q6.md docs/prompts/d5-q3.md docs/prompts/d6-q4.md; do
    if [ -f "$prompt" ]; then
        if grep -q "S1.*发散探索" "$prompt" && grep -q "S2.*第一性原理" "$prompt" && grep -q "S3.*反事实" "$prompt" && grep -q "S4.*评分" "$prompt" && grep -q "S5.*输出格式" "$prompt"; then
            echo "  ✅ $prompt (S1-S5 structure verified)"
        else
            echo "  ❌ $prompt: missing required S1-S5 sections"
            errors=$((errors + 1))
        fi
    fi
done

# Profile checks
echo ""
echo "Patterns..."
check_min_size "docs/patterns/temporal-patterns.md" 3000
check_min_size "docs/patterns/bayesian-hypothesis.md" 3000
check_min_size "docs/patterns/triz-8-principles.md" 3000

check_min_size "docs/quick-ref.md" 3000

echo ""
echo "Profile: IATF 16949..."
if [ -d "profiles/iatf16949" ]; then
    check_file "profiles/iatf16949/SKILL.md"
    check_frontmatter "profiles/iatf16949/SKILL.md"
    check_file "profiles/iatf16949/overlay.md"
    check_file "profiles/iatf16949/README.md"
    for p in safe-launch special-chars csr-check supplier-8d ppap-impact; do
        check_min_size "profiles/iatf16949/prompts/${p}.md" 2000
    done
    for r in clauses oem-timelines characteristic-types; do
        check_file "profiles/iatf16949/references/${r}.md"
    done
    check_file "profiles/iatf16949/examples/auto-8d-walkthrough.md"
else
    echo "  ℹ️  profiles/iatf16949/ not found (optional)"
fi

echo ""
echo "Profile: ISO 9001:2015..."
if [ -d "profiles/iso9001" ]; then
    check_file "profiles/iso9001/SKILL.md"
    check_frontmatter "profiles/iso9001/SKILL.md"
    check_file "profiles/iso9001/README.md"
    check_file "profiles/iso9001/overlay.md"
    for p in risk-thinking change-control ncr-control corrective-action doc-control; do
        check_min_size "profiles/iso9001/prompts/${p}.md" 2000
    done
    for r in clauses risk-based; do
        check_file "profiles/iso9001/references/${r}.md"
    done
    check_file "profiles/iso9001/examples/iso-8d-walkthrough.md"
else
    echo "  ℹ️  profiles/iso9001/ not found (optional)"
fi

echo ""
echo "Total files checked: $TOTAL_FILES"
if [ "$errors" -eq 0 ]; then
    echo "==> ✅ All checks passed. 8d-guru v0.2.1 is ready."
else
    echo "==> ❌ $errors check(s) failed."
    exit 1
fi
