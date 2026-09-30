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
		ObjectName:   "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.",
		ParameterKey: "auto-provisioning",
	}
	encoded, err := GenerateSOAPEnvelopeWithContext(request, CWMPNamespace10, "addobj-1")
	if err != nil {
		t.Fatalf("GenerateSOAPEnvelopeWithContext: %v", err)
	}
	for _, expected := range []string{"AddObject", "<ObjectName>InternetGatewayDevice.WANDevice.1.WANConnectionDevice.</ObjectName>", "<ParameterKey>auto-provisioning</ParameterKey>", "addobj-1"} {
		if !bytes.Contains(encoded, []byte(expected)) {
			t.Fatalf("missing %q in SOAP: %s", expected, encoded)
		}
	}
	if bytes.Contains(encoded, []byte("<ParameterName>")) {
		t.Fatalf("AddObject contains unsupported ParameterName: %s", encoded)
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
  <soap:Body><cwmp:AddObjectResponse><InstanceNumber>2</InstanceNumber><Status>0</Status></cwmp:AddObjectResponse></soap:Body>
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
	if envelope.Body.AddObjectResponse.Status != 0 {
		t.Fatalf("unexpected Status %d", envelope.Body.AddObjectResponse.Status)
	}
}

func TestParseAddObjectFault(t *testing.T) {
	payload := `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
  <soap:Body><soap:Fault><faultcode>Client</faultcode><faultstring>CWMP fault</faultstring>
    <detail><cwmp:Fault><FaultCode>9005</FaultCode><FaultString>Invalid parameter name</FaultString></cwmp:Fault></detail>
  </soap:Fault></soap:Body>
</soap:Envelope>`
	envelope, err := ParseSOAPEnvelope(strings.NewReader(payload))
	if err != nil {
		t.Fatalf("ParseSOAPEnvelope: %v", err)
	}
	if got := DetectMessageType(&envelope.Body); got != "Fault" {
		t.Fatalf("unexpected message type %q", got)
	}
	fault := envelope.Body.Fault
	if fault == nil || fault.Detail.CWMPFault == nil || fault.Detail.CWMPFault.FaultCode != "9005" {
		t.Fatalf("CWMP fault not parsed: %+v", fault)
	}
}
