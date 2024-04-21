#include <Adafruit_Fingerprint.h>

#include <DHT.h>
#include <DHT_U.h>

#include <Adafruit_Sensor.h>

#define DHTPIN 2     
#define DHTTYPE DHT22   
DHT dht(DHTPIN, DHTTYPE); 


//Variables
float hum;  //Stores humidity value
float temp; //Stores temperature value

volatile int finger_status = -1;
SoftwareSerial mySerial(3, 4); // TX/RX on fingerprint sensor
String command = "";
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);
uint8_t id;
void setup() {
  pinMode(A0, INPUT);
  Serial.begin(9600);
  dht.begin();
  while (!Serial);  // For Yun/Leo/Micro/Zero/...
  delay(100);

    finger.begin(57600);

  if (finger.verifyPassword()) {
    Serial.println("Found fingerprint sensor!");
  } else {
    Serial.println("Did not find fingerprint sensor :(");
    while (1) { delay(1); }
  }
  finger.getTemplateCount();
  Serial.print("Sensor contains "); Serial.print(finger.templateCount); Serial.println(" templates");
  Serial.println("Waiting for valid finger...");
}

void loop() {
  float LDR_value = analogRead(A0);
  float LDR_resistance = (5.000*(1023-LDR_value))/LDR_value;
  float lux = 3000/LDR_resistance;
  hum = dht.readHumidity();
  temp= dht.readTemperature();

  Serial.print("Light: ");
  Serial.print(lux);
  Serial.print("lx, Humidity: ");
  Serial.print(hum);
  Serial.print(" %, Temp: ");
  Serial.print(temp);
  Serial.println(" Celsius");

  verifyFingerprint();

  if (Serial.available() > 0) {
    char incomingChar = Serial.read();
    if (incomingChar == '\n') {
      processCommand(command);
      command = "";
    } else {
      command += incomingChar;
    }
  }

  delay(1000);
}

void verifyFingerprint() {
  finger_status = getFingerprintIDez();
  if (finger_status != -1 && finger_status != -2) {
    Serial.print("Match: Fingerprint ID #");
    Serial.println(finger_status);
  } else {
    if (finger_status == -2) {
      Serial.println("Not Match: Fingerprint not found");
    }
  }
}

int getFingerprintIDez() {
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK)  return -1;

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK)  return -1;

  p = finger.fingerFastSearch();
  if (p != FINGERPRINT_OK)  return -2;

  // found a match!

  return finger.fingerID;
}

void processCommand(String cmd) {
  // Process the received command here
  if (cmd == "Register") {
    // Code to initiate fingerprint enrollment
    Serial.println("Received Fingerprint enroll command from Node.js");
    // Add your enrollment logic here
  } else {
    Serial.println("Unknown command received from Node.js");
  }
    Serial.println("Ready to enroll a fingerprint!");
    id = finger.templateCount + 1;
    Serial.print("Enrolling for ID #");Serial.println(id);
      while (!  getFingerprintEnroll() );
}

uint8_t getFingerprintEnroll() {
  int p = -1;
  Serial.println("Please place your finger on the scanner...");
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Image taken");
      break;
    case FINGERPRINT_NOFINGER:
      break;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Communication error");
      break;
    case FINGERPRINT_IMAGEFAIL:
      Serial.println("Imaging error");
      break;
    default:
      Serial.println("Unknown error");
      break;
    }
  }
  // OK success!
  p = finger.image2Tz(1);
  switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Image converted");
      break;
    case FINGERPRINT_IMAGEMESS:
      Serial.println("Image too messy");
      return p;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Communication error");
      return p;
    case FINGERPRINT_FEATUREFAIL:
      Serial.println("Could not find fingerprint features");
      return p;
    case FINGERPRINT_INVALIDIMAGE:
      Serial.println("Could not find fingerprint features");
      return p;
    default:
      Serial.println("Unknown error");
      return p;
  }
  delay(2000);
  Serial.println("Remove finger");
  delay(2000);
  p = 0;
  while (p != FINGERPRINT_NOFINGER) {
    p = finger.getImage();
  }
  Serial.print("ID "); Serial.println(id);
  p = -1;
  Serial.println("Place same finger again");
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Image taken");
      break;
    case FINGERPRINT_NOFINGER:
      break;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Communication error");
      break;
    case FINGERPRINT_IMAGEFAIL:
      Serial.println("Imaging error");
      break;
    default:
      Serial.println("Unknown error");
      break;
    }
  }
  // OK success!
  p = finger.image2Tz(2);
  switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Image converted");
      break;
    case FINGERPRINT_IMAGEMESS:
      Serial.println("Image too messy");
      return p;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Communication error");
      return p;
    case FINGERPRINT_FEATUREFAIL:
      Serial.println("Could not find fingerprint features");
      return p;
    case FINGERPRINT_INVALIDIMAGE:
      Serial.println("Could not find fingerprint features");
      return p;
    default:
      Serial.println("Unknown error");
      return p;
  }
    delay(2000);
  // OK converted!
  Serial.print("Creating model...");  Serial.println(id);
    delay(2000);
  p = finger.createModel();
  if (p == FINGERPRINT_OK) {
    Serial.println("Prints matched!");
      delay(2000);
  } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
    Serial.println("Communication error");
    return p;
  } else if (p == FINGERPRINT_ENROLLMISMATCH) {
    Serial.println("Fingerprints did not match");
    return p;
  } else {
    Serial.println("Unknown error");
    return p;
  }

  Serial.print("ID "); Serial.println(id);
  p = finger.storeModel(id);
  if (p == FINGERPRINT_OK) {
    Serial.println("Fingerprint Stored!");
  } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
    Serial.println("Communication error");
    return p;
  } else if (p == FINGERPRINT_BADLOCATION) {
    Serial.println("Could not store in that location");
    return p;
  } else if (p == FINGERPRINT_FLASHERR) {
    Serial.println("Error writing to flash");
    return p;
  } else {
    Serial.println("Unknown error");
    return p;
  }
}
