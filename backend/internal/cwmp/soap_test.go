package cwmp

import (
	"bytes"
	"encoding/xml"
	"strings"
	"testing"
)

func TestParseSOAPAcceptsCWMP12AndDetectsTransferComplete(t *testing.T) {
	payload := `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cwmp="urn:dslforum-org:cwmp-1-2">
  <soap:Header><cwmp:ID soap:mustUnderstand="1">request-42</cwmp:ID></soap:Header>
  <soap:Body><cwmp:TransferComplete><CommandKey>skyacs-task-9</CommandKey><FaultStruct><FaultCode>0</FaultCode><FaultString></FaultString></FaultStruct><StartTime>2026-01-01T00:00:00Z</StartTime><CompleteTime>2026-01-01T00:01:00Z</CompleteTime></cwmp:TransferComplete></soap:Body>
</soap:Envelope>`
	envelope, err := ParseSOAPEnvelope(strings.NewReader(payload))
	if err != nil {
		t.Fatalf("ParseSOAPEnvelope: %v", err)
	}
	if envelope.CWMPNamespace != "urn:dslforum-org:cwmp-1-2" {
		t.Fatalf("unexpected namespace %q", envelope.CWMPNamespace)
	}
	if envelope.Header.ID != "request-42" {
		t.Fatalf("unexpected ID %q", envelope.Header.ID)
	}
	if got := DetectMessageType(&envelope.Body); got != "TransferComplete" {
		t.Fatalf("unexpected message type %q", got)
	}
}

func TestSOAPResponseEchoesIDNamespaceAndTransferComplete(t *testing.T) {
	request := &SOAPEnvelope{CWMPNamespace: "urn:dslforum-org:cwmp-1-2", Header: SOAPHeader{ID: "request-42"}}
	encoded, err := GenerateSOAPEnvelopeForRequest(&TransferCompleteResponse{}, request)
	if err != nil {
		t.Fatalf("GenerateSOAPEnvelopeForRequest: %v", err)
	}
	if !bytes.Contains(encoded, []byte("request-42")) || !bytes.Contains(encoded, []byte("TransferCompleteResponse")) {
		t.Fatalf("response does not echo request metadata: %s", encoded)
	}
	if !bytes.Contains(encoded, []byte("urn:dslforum-org:cwmp-1-2")) {
		t.Fatalf("response lost CWMP namespace: %s", encoded)
	}
	var document interface{}
	if err := xml.Unmarshal(encoded, &document); err != nil {
		t.Fatalf("generated SOAP is not well formed: %v\n%s", err, encoded)
	}
}

func TestSetParameterValuesIncludesSOAPTypesAndArrayMetadata(t *testing.T) {
	request := &SetParameterValues{
		ParameterList: ParameterList{Parameters: []ParameterValueStruct{
			{Name: "Device.ManagementServer.PeriodicInformEnable", Value: "true", Type: "boolean"},
		}},
		ParameterKey: "skyacs-task-10",
	}
	encoded, err := GenerateSOAPEnvelopeWithContext(request, CWMPNamespace10, "command-10")
	if err != nil {
		t.Fatalf("GenerateSOAPEnvelopeWithContext: %v", err)
	}
	for _, expected := range []string{"arrayType", "ParameterValueStruct[1]", "xsi:type", "xsd:boolean"} {
		if !bytes.Contains(encoded, []byte(expected)) {
			t.Fatalf("missing %q in SOAP: %s", expected, encoded)
		}
	}
	var document interface{}
	if err := xml.Unmarshal(encoded, &document); err != nil {
		t.Fatalf("generated SOAP is not well formed: %v\n%s", err, encoded)
	}
}

func TestAddObjectSerializesCorrectly(t *testing.T) {
	request := &AddObject{
		ParameterName: "InternetGatewayDevice.WANDevice.1.WANConnectionDevice",
		ObjectName:    "WANConnectionDevice",
	}
	encoded, err := GenerateSOAPEnvelopeWithContext(request, CWMPNamespace10, "addobj-1")
	if err != nil {
		t.Fatalf("GenerateSOAPEnvelopeWithContext: %v", err)
	}
	for _, expected := range []string{"AddObject", "InternetGatewayDevice.WANDevice.1.WANConnectionDevice", "WANConnectionDevice", "addobj-1"} {
		if !bytes.Contains(encoded, []byte(expected)) {
			t.Fatalf("missing %q in SOAP: %s", expected, encoded)
		}
	}
	var document interface{}
	if err := xml.Unmarshal(encoded, &document); err != nil {
		t.Fatalf("generated SOAP is not well formed: %v\n%s", err, encoded)
	}
}

func TestParseAddObjectResponse(t *testing.T) {
	payload := `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
  <soap:Header><cwmp:ID soap:mustUnderstand="1">req-1</cwmp:ID></soap:Header>
  <soap:Body><cwmp:AddObjectResponse><InstanceNumber>2</InstanceNumber><FaultCode>0</FaultCode><FaultString></FaultString></cwmp:AddObjectResponse></soap:Body>
</soap:Envelope>`
	envelope, err := ParseSOAPEnvelope(strings.NewReader(payload))
	if err != nil {
		t.Fatalf("ParseSOAPEnvelope: %v", err)
	}
	if got := DetectMessageType(&envelope.Body); got != "AddObjectResponse" {
		t.Fatalf("unexpected message type %q", got)
	}
	if envelope.Body.AddObjectResponse == nil {
		t.Fatal("AddObjectResponse is nil")
	}
	if envelope.Body.AddObjectResponse.InstanceNumber != "2" {
		t.Fatalf("unexpected InstanceNumber %q", envelope.Body.AddObjectResponse.InstanceNumber)
	}
	if envelope.Body.AddObjectResponse.FaultCode != "0" {
		t.Fatalf("unexpected FaultCode %q", envelope.Body.AddObjectResponse.FaultCode)
	}
}

func TestLastPathSegment(t *testing.T) {
	tests := []struct {
		path string
		want string
	}{
		{"InternetGatewayDevice.WANDevice.1.WANConnectionDevice", "WANConnectionDevice"},
		{"InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANIPConnection", "WANIPConnection"},
		{"Device", "Device"},
		{"", ""},
	}
	for _, tt := range tests {
		if got := lastPathSegment(tt.path); got != tt.want {
			t.Errorf("lastPathSegment(%q) = %q, want %q", tt.path, got, tt.want)
		}
	}
}
