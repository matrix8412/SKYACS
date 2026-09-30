package cwmp

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestInformIsAcknowledgedBeforeACSRequest(t *testing.T) {
	handler := NewHandler(nil)
	inform := `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
  <soap:Header><cwmp:ID soap:mustUnderstand="1">inform-1</cwmp:ID></soap:Header>
  <soap:Body><cwmp:Inform>
    <DeviceId><Manufacturer>Lab</Manufacturer><OUI>001122</OUI><ProductClass>ONU</ProductClass><SerialNumber>TEST-1</SerialNumber></DeviceId>
    <Event><EventStruct><EventCode>0 BOOTSTRAP</EventCode><CommandKey></CommandKey></EventStruct></Event>
    <MaxEnvelopes>1</MaxEnvelopes><CurrentTime>2026-01-01T00:00:00Z</CurrentTime><RetryCount>0</RetryCount>
    <ParameterList><ParameterValueStruct><Name>Device.DeviceInfo.SerialNumber</Name><Value>TEST-1</Value></ParameterValueStruct></ParameterList>
  </cwmp:Inform></soap:Body>
</soap:Envelope>`

	request := httptest.NewRequest(http.MethodPost, "http://acs.test/", strings.NewReader(inform))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	response := recorder.Result()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("unexpected Inform status %d: %s", response.StatusCode, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "InformResponse") || strings.Contains(recorder.Body.String(), "GetParameterValues") {
		t.Fatalf("Inform was not acknowledged before ACS request: %s", recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "inform-1") {
		t.Fatalf("Inform ID was not echoed: %s", recorder.Body.String())
	}

	cookies := response.Cookies()
	if len(cookies) == 0 {
		t.Fatal("CWMP session cookie was not set")
	}
	emptyRequest := httptest.NewRequest(http.MethodPost, "http://acs.test/", nil)
	emptyRequest.AddCookie(cookies[0])
	emptyRecorder := httptest.NewRecorder()
	handler.ServeHTTP(emptyRecorder, emptyRequest)
	if emptyRecorder.Code != http.StatusOK || !strings.Contains(emptyRecorder.Body.String(), "GetParameterValues") {
		t.Fatalf("ACS request was not dispatched after empty POST: status=%d body=%s", emptyRecorder.Code, emptyRecorder.Body.String())
	}
}

// TestPeriodicInformOnNewSessionTriggersAutoFetch verifies that a PERIODIC
// event on a brand-new session (e.g. after an ACS restart) still triggers the
// full-tree parameter fetch so WAN/WiFi/health data is available.
func TestPeriodicInformOnNewSessionTriggersAutoFetch(t *testing.T) {
	handler := NewHandler(nil)
	inform := `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
  <soap:Header><cwmp:ID soap:mustUnderstand="1">inform-periodic</cwmp:ID></soap:Header>
  <soap:Body><cwmp:Inform>
    <DeviceId><Manufacturer>Huawei</Manufacturer><OUI>001122</OUI><ProductClass>EG8145V5</ProductClass><SerialNumber>HW-PERIODIC-1</SerialNumber></DeviceId>
    <Event><EventStruct><EventCode>4 PERIODIC</EventCode><CommandKey></CommandKey></EventStruct></Event>
    <MaxEnvelopes>1</MaxEnvelopes><CurrentTime>2026-09-29T06:20:00Z</CurrentTime><RetryCount>0</RetryCount>
    <ParameterList><ParameterValueStruct><Name>InternetGatewayDevice.DeviceInfo.SerialNumber</Name><Value>HW-PERIODIC-1</Value></ParameterValueStruct></ParameterList>
  </cwmp:Inform></soap:Body>
</soap:Envelope>`

	request := httptest.NewRequest(http.MethodPost, "http://acs.test/", strings.NewReader(inform))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected Inform status %d: %s", recorder.Code, recorder.Body.String())
	}

	cookies := recorder.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("CWMP session cookie was not set")
	}
	emptyRequest := httptest.NewRequest(http.MethodPost, "http://acs.test/", nil)
	emptyRequest.AddCookie(cookies[0])
	emptyRecorder := httptest.NewRecorder()
	handler.ServeHTTP(emptyRecorder, emptyRequest)
	if emptyRecorder.Code != http.StatusOK || !strings.Contains(emptyRecorder.Body.String(), "GetParameterValues") {
		t.Fatalf("full-tree fetch was not dispatched for new-session PERIODIC inform: status=%d body=%s", emptyRecorder.Code, emptyRecorder.Body.String())
	}
}

// TestPeriodicInformOnExistingSessionDoesNotReTriggerAutoFetch verifies that
// after the AutoFetch is consumed, a subsequent empty POST on the same session
// does NOT re-trigger the full-tree fetch (keeps periodic informs cheap).
func TestPeriodicInformOnExistingSessionDoesNotReTriggerAutoFetch(t *testing.T) {
	handler := NewHandler(nil)
	inform := `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
  <soap:Header><cwmp:ID soap:mustUnderstand="1">inform-1</cwmp:ID></soap:Header>
  <soap:Body><cwmp:Inform>
    <DeviceId><Manufacturer>Huawei</Manufacturer><OUI>001122</OUI><ProductClass>EG8145V5</ProductClass><SerialNumber>HW-EXISTING-1</SerialNumber></DeviceId>
    <Event><EventStruct><EventCode>4 PERIODIC</EventCode><CommandKey></CommandKey></EventStruct></Event>
    <MaxEnvelopes>1</MaxEnvelopes><CurrentTime>2026-09-29T06:20:00Z</CurrentTime><RetryCount>0</RetryCount>
    <ParameterList><ParameterValueStruct><Name>InternetGatewayDevice.DeviceInfo.SerialNumber</Name><Value>HW-EXISTING-1</Value></ParameterValueStruct></ParameterList>
  </cwmp:Inform></soap:Body>
</soap:Envelope>`

	req1 := httptest.NewRequest(http.MethodPost, "http://acs.test/", strings.NewReader(inform))
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("first Inform failed: %d", rec1.Code)
	}
	cookies := rec1.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("session cookie not set")
	}

	// Consume the AutoFetch (empty POST → GetParameterValues)
	emptyReq := httptest.NewRequest(http.MethodPost, "http://acs.test/", nil)
	emptyReq.AddCookie(cookies[0])
	emptyRec := httptest.NewRecorder()
	handler.ServeHTTP(emptyRec, emptyReq)
	if !strings.Contains(emptyRec.Body.String(), "GetParameterValues") {
		t.Fatalf("expected GetParameterValues on first empty POST, got: %s", emptyRec.Body.String())
	}

	// Second empty POST on the same session: AutoFetch already consumed.
	emptyReq2 := httptest.NewRequest(http.MethodPost, "http://acs.test/", nil)
	emptyReq2.AddCookie(cookies[0])
	emptyRec2 := httptest.NewRecorder()
	handler.ServeHTTP(emptyRec2, emptyReq2)
	if strings.Contains(emptyRec2.Body.String(), "GetParameterValues") {
		t.Fatalf("AutoFetch was re-triggered on existing session: %s", emptyRec2.Body.String())
	}
}

// TestAddObjectParentPathDerivation verifies that the parent path is correctly
// derived from the full AddObjectPath for the AddObject SOAP call.
// TR-069 requires ParameterName to be the parent object path (without the
// last segment), and ObjectName to be the last segment.
func TestAddObjectParentPathDerivation(t *testing.T) {
	tests := []struct {
		name         string
		addObjectPath string
		wantParent   string
		wantObject   string
		wantSkip     bool
	}{
		{
			name:         "multi-segment path",
			addObjectPath: "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANIPConnection",
			wantParent:   "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2",
			wantObject:   "WANIPConnection",
		},
		{
			name:         "two-segment path",
			addObjectPath: "InternetGatewayDevice.WANDevice",
			wantParent:   "InternetGatewayDevice",
			wantObject:   "WANDevice",
		},
		{
			name:         "single-segment path has no parent",
			addObjectPath: "WANIPConnection",
			wantParent:   "",
			wantObject:   "WANIPConnection",
			wantSkip:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			objName := lastPathSegment(tt.addObjectPath)
			if objName != tt.wantObject {
				t.Fatalf("lastPathSegment = %q, want %q", objName, tt.wantObject)
			}
			parentPath := strings.TrimSuffix(tt.addObjectPath, "."+objName)
			if tt.wantSkip {
				if parentPath != tt.addObjectPath {
					t.Fatalf("expected parentPath unchanged for single-segment path, got %q", parentPath)
				}
				return
			}
			if parentPath != tt.wantParent {
				t.Fatalf("parentPath = %q, want %q", parentPath, tt.wantParent)
			}
			// Verify the AddObject struct would be correct
			addObj := &AddObject{
				ParameterName: parentPath,
				ObjectName:    objName,
			}
			if addObj.ParameterName == addObj.ObjectName {
				t.Fatalf("ParameterName and ObjectName are identical (%q) — parent path not derived", addObj.ParameterName)
			}
		})
	}
}
