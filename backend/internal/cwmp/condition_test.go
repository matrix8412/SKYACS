package cwmp

import (
	"testing"
)

func TestParseCondition_Empty(t *testing.T) {
	cond, err := ParseCondition("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cond != nil {
		t.Fatal("expected nil condition for empty string")
	}
}

func TestParseCondition_SimpleEq(t *testing.T) {
	cond, err := ParseCondition(`InternetGatewayDevice.DeviceInfo.Manufacturer == 'SkyDash'`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cond.Op != OpCompare || cond.Compare != CmpEq {
		t.Fatalf("expected OpCompare/CmpEq, got %v/%v", cond.Op, cond.Compare)
	}
	if cond.Left != "InternetGatewayDevice.DeviceInfo.Manufacturer" {
		t.Errorf("unexpected left: %q", cond.Left)
	}
	if cond.Right != "SkyDash" {
		t.Errorf("unexpected right: %q", cond.Right)
	}
}

func TestParseCondition_Neq(t *testing.T) {
	cond, err := ParseCondition(`Device.State != 'offline'`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cond.Compare != CmpNeq {
		t.Fatalf("expected CmpNeq, got %v", cond.Compare)
	}
}

func TestParseCondition_Numeric(t *testing.T) {
	cond, err := ParseCondition(`Device.SignalStrength > 50`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cond.Compare != CmpGt {
		t.Fatalf("expected CmpGt, got %v", cond.Compare)
	}
}

func TestParseCondition_And(t *testing.T) {
	cond, err := ParseCondition(`A.B == 'x' AND C.D == 'y'`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cond.Op != OpAnd {
		t.Fatalf("expected OpAnd, got %v", cond.Op)
	}
	if len(cond.Children) != 2 {
		t.Fatalf("expected 2 children, got %d", len(cond.Children))
	}
}

func TestParseCondition_Or(t *testing.T) {
	cond, err := ParseCondition(`A.B == 'x' OR C.D == 'y'`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cond.Op != OpOr {
		t.Fatalf("expected OpOr, got %v", cond.Op)
	}
}

func TestParseCondition_Not(t *testing.T) {
	cond, err := ParseCondition(`NOT A.B == 'x'`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cond.Op != OpNot {
		t.Fatalf("expected OpNot, got %v", cond.Op)
	}
	if cond.Sub == nil || cond.Sub.Op != OpCompare {
		t.Fatal("expected sub to be a comparison")
	}
}

func TestParseCondition_Parentheses(t *testing.T) {
	cond, err := ParseCondition(`(A.B == 'x' OR C.D == 'y') AND E.F == 'z'`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cond.Op != OpAnd {
		t.Fatalf("expected OpAnd, got %v", cond.Op)
	}
	if len(cond.Children) != 2 {
		t.Fatalf("expected 2 children, got %d", len(cond.Children))
	}
	if cond.Children[0].Op != OpOr {
		t.Fatalf("expected first child to be OpOr, got %v", cond.Children[0].Op)
	}
}

func TestParseCondition_Contains(t *testing.T) {
	cond, err := ParseCondition(`Device.Model contains 'AC1000'`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cond.Compare != CmpContains {
		t.Fatalf("expected CmpContains, got %v", cond.Compare)
	}
}

func TestParseCondition_Matches(t *testing.T) {
	cond, err := ParseCondition(`Device.SerialNumber matches '^[A-Z]{4}-\\d+$'`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cond.Compare != CmpMatches {
		t.Fatalf("expected CmpMatches, got %v", cond.Compare)
	}
}

func TestParseCondition_Invalid(t *testing.T) {
	invalidExprs := []string{
		`A.B ==`,
		`== 'x'`,
		`A.B == 'x' AND`,
		`(A.B == 'x'`,
		`A.B === 'x'`,
	}
	for _, expr := range invalidExprs {
		if _, err := ParseCondition(expr); err == nil {
			t.Errorf("expected error for %q, got nil", expr)
		}
	}
}

func TestEvaluate_NilCondition(t *testing.T) {
	result, err := Evaluate(nil, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Fatal("nil condition should always be true")
	}
}

func TestEvaluate_Eq(t *testing.T) {
	cond, _ := ParseCondition(`A.B == 'hello'`)
	params := map[string]string{"A.B": "hello"}
	result, err := Evaluate(cond, params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Fatal("expected true")
	}

	params["A.B"] = "world"
	result, _ = Evaluate(cond, params)
	if result {
		t.Fatal("expected false")
	}
}

func TestEvaluate_Neq(t *testing.T) {
	cond, _ := ParseCondition(`A.B != 'hello'`)
	params := map[string]string{"A.B": "world"}
	result, _ := Evaluate(cond, params)
	if !result {
		t.Fatal("expected true")
	}
}

func TestEvaluate_Numeric(t *testing.T) {
	cond, _ := ParseCondition(`A.B > 10`)
	params := map[string]string{"A.B": "20"}
	result, _ := Evaluate(cond, params)
	if !result {
		t.Fatal("expected 20 > 10 to be true")
	}

	params["A.B"] = "5"
	result, _ = Evaluate(cond, params)
	if result {
		t.Fatal("expected 5 > 10 to be false")
	}
}

func TestEvaluate_And(t *testing.T) {
	cond, _ := ParseCondition(`A.B == 'x' AND C.D == 'y'`)
	params := map[string]string{"A.B": "x", "C.D": "y"}
	result, _ := Evaluate(cond, params)
	if !result {
		t.Fatal("expected true")
	}

	params["C.D"] = "z"
	result, _ = Evaluate(cond, params)
	if result {
		t.Fatal("expected false")
	}
}

func TestEvaluate_Or(t *testing.T) {
	cond, _ := ParseCondition(`A.B == 'x' OR C.D == 'y'`)
	params := map[string]string{"A.B": "z", "C.D": "y"}
	result, _ := Evaluate(cond, params)
	if !result {
		t.Fatal("expected true (OR)")
	}

	params["A.B"] = "z"
	params["C.D"] = "z"
	result, _ = Evaluate(cond, params)
	if result {
		t.Fatal("expected false")
	}
}

func TestEvaluate_Not(t *testing.T) {
	cond, _ := ParseCondition(`NOT A.B == 'x'`)
	params := map[string]string{"A.B": "y"}
	result, _ := Evaluate(cond, params)
	if !result {
		t.Fatal("expected true (NOT x == y)")
	}

	params["A.B"] = "x"
	result, _ = Evaluate(cond, params)
	if result {
		t.Fatal("expected false (NOT x == x)")
	}
}

func TestEvaluate_Contains(t *testing.T) {
	cond, _ := ParseCondition(`Device.Model contains 'AC1000'`)
	params := map[string]string{"Device.Model": "SkyDash AC1000-Plus"}
	result, _ := Evaluate(cond, params)
	if !result {
		t.Fatal("expected true")
	}
}

func TestEvaluate_Matches(t *testing.T) {
	cond, _ := ParseCondition(`Device.SerialNumber matches '^[A-Z]{4}-\d+$'`)
	params := map[string]string{"Device.SerialNumber": "ABCD-1234"}
	result, _ := Evaluate(cond, params)
	if !result {
		t.Fatal("expected true")
	}

	params["Device.SerialNumber"] = "abcd-1234"
	result, _ = Evaluate(cond, params)
	if result {
		t.Fatal("expected false (lowercase)")
	}
}

func TestEvaluate_MissingParam(t *testing.T) {
	cond, _ := ParseCondition(`A.B == 'x'`)
	result, _ := Evaluate(cond, map[string]string{})
	if result {
		t.Fatal("expected false when param is missing")
	}
}

func TestExtractParamNames(t *testing.T) {
	cond, _ := ParseCondition(`A.B == 'x' AND C.D > 5`)
	params := ExtractParamNames(cond)
	if len(params) != 2 {
		t.Fatalf("expected 2 params, got %d: %v", len(params), params)
	}
	if params[0] != "A.B" || params[1] != "C.D" {
		t.Errorf("unexpected params: %v", params)
	}
}

func TestExtractParamNames_Nil(t *testing.T) {
	params := ExtractParamNames(nil)
	if params != nil {
		t.Fatal("expected nil for nil condition")
	}
}

func TestExtractParamNames_Dedup(t *testing.T) {
	cond, _ := ParseCondition(`A.B == 'x' OR A.B == 'y'`)
	params := ExtractParamNames(cond)
	if len(params) != 1 {
		t.Fatalf("expected 1 unique param, got %d: %v", len(params), params)
	}
}

func TestValidateCondition_Valid(t *testing.T) {
	validExprs := []string{
		``,
		`A.B == 'x'`,
		`A.B != 'x'`,
		`A.B > 5`,
		`A.B < 5`,
		`A.B >= 5`,
		`A.B <= 5`,
		`A.B contains 'x'`,
		`A.B matches '^x$'`,
		`A.B == 'x' AND C.D == 'y'`,
		`A.B == 'x' OR C.D == 'y'`,
		`NOT A.B == 'x'`,
		`(A.B == 'x' OR C.D == 'y') AND E.F == 'z'`,
	}
	for _, expr := range validExprs {
		if err := ValidateCondition(expr); err != nil {
			t.Errorf("expected valid: %q, got error: %v", expr, err)
		}
	}
}

func TestValidateCondition_Invalid(t *testing.T) {
	invalidExprs := []string{
		`A.B ==`,
		`== 'x'`,
		`A.B == 'x' AND`,
		`(A.B == 'x'`,
		`A.B === 'x'`,
	}
	for _, expr := range invalidExprs {
		if err := ValidateCondition(expr); err == nil {
			t.Errorf("expected error for: %q", expr)
		}
	}
}

func TestParseCondition_HasTag(t *testing.T) {
	cond, err := ParseCondition(`hasTag('branch-a')`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cond.Op != OpHasTag {
		t.Fatalf("expected OpHasTag, got %v", cond.Op)
	}
	if cond.Right != "branch-a" {
		t.Errorf("unexpected tag: %q", cond.Right)
	}
}

func TestParseCondition_NotHasTag(t *testing.T) {
	cond, err := ParseCondition(`notHasTag('blocked')`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cond.Op != OpNotHasTag {
		t.Fatalf("expected OpNotHasTag, got %v", cond.Op)
	}
	if cond.Right != "blocked" {
		t.Errorf("unexpected tag: %q", cond.Right)
	}
}

func TestParseCondition_HasTagWithAnd(t *testing.T) {
	cond, err := ParseCondition(`hasTag('branch-a') AND A.B == 'x'`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cond.Op != OpAnd {
		t.Fatalf("expected OpAnd, got %v", cond.Op)
	}
	if len(cond.Children) != 2 {
		t.Fatalf("expected 2 children, got %d", len(cond.Children))
	}
	if cond.Children[0].Op != OpHasTag {
		t.Errorf("expected first child OpHasTag, got %v", cond.Children[0].Op)
	}
}

func TestParseCondition_HasTagInvalid(t *testing.T) {
	invalidExprs := []string{
		`hasTag()`,
		`hasTag('a'`,
		`hasTag`,
		`notHasTag`,
	}
	for _, expr := range invalidExprs {
		if err := ValidateCondition(expr); err == nil {
			t.Errorf("expected error for: %q", expr)
		}
	}
}

func TestEvaluate_HasTag(t *testing.T) {
	cond, _ := ParseCondition(`hasTag('branch-a')`)
	params := map[string]string{"device.tags": "branch-a,branch-b"}
	result, err := Evaluate(cond, params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Fatal("expected true (device has tag branch-a)")
	}

	params["device.tags"] = "branch-b,branch-c"
	result, _ = Evaluate(cond, params)
	if result {
		t.Fatal("expected false (device does not have tag branch-a)")
	}
}

func TestEvaluate_NotHasTag(t *testing.T) {
	cond, _ := ParseCondition(`notHasTag('blocked')`)
	params := map[string]string{"device.tags": "branch-a,branch-b"}
	result, err := Evaluate(cond, params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Fatal("expected true (device does not have tag blocked)")
	}

	params["device.tags"] = "branch-a,blocked"
	result, _ = Evaluate(cond, params)
	if result {
		t.Fatal("expected false (device has tag blocked)")
	}
}

func TestEvaluate_HasTagNoTags(t *testing.T) {
	cond, _ := ParseCondition(`hasTag('branch-a')`)
	result, _ := Evaluate(cond, map[string]string{})
	if result {
		t.Fatal("expected false when no tags are set")
	}
}

func TestEvaluate_HasTagCombined(t *testing.T) {
	cond, _ := ParseCondition(`hasTag('branch-a') AND A.B == 'x'`)
	params := map[string]string{"device.tags": "branch-a", "A.B": "x"}
	result, _ := Evaluate(cond, params)
	if !result {
		t.Fatal("expected true (both conditions met)")
	}

	params["A.B"] = "y"
	result, _ = Evaluate(cond, params)
	if result {
		t.Fatal("expected false (A.B mismatch)")
	}
}

func TestExtractParamNames_HasTag(t *testing.T) {
	cond, _ := ParseCondition(`hasTag('branch-a') AND A.B == 'x'`)
	params := ExtractParamNames(cond)
	if len(params) != 1 {
		t.Fatalf("expected 1 CWMP param (A.B), got %d: %v", len(params), params)
	}
	if params[0] != "A.B" {
		t.Errorf("unexpected param: %q", params[0])
	}
}

func TestValidateCondition_HasTagValid(t *testing.T) {
	validExprs := []string{
		`hasTag('branch-a')`,
		`notHasTag('blocked')`,
		`hasTag('a') AND hasTag('b')`,
		`NOT hasTag('blocked')`,
		`(hasTag('a') OR hasTag('b')) AND A.B == 'x'`,
	}
	for _, expr := range validExprs {
		if err := ValidateCondition(expr); err != nil {
			t.Errorf("expected valid: %q, got error: %v", expr, err)
		}
	}
}