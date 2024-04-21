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

void setup() {
  pinMode(A0, INPUT);
  Serial.begin(9600);
  dht.begin();
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

  delay(1000);
}

