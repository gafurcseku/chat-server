// Medicine.js
const mongoose = require("mongoose");

const MedicineSchema = new mongoose.Schema({
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" }, 
  name: String,
  image: String,
  generic: String,
  strength: String,
  company: String,
  priceLabel:String,
  unitPrice: String,
  stripPrice: String,
  packInfo: String,
  indications: String,
  composition: String,
  pharmacology: String,
  dosage: String,
  interaction: String,
  contraindications: String,
  sideEffects: String,
  pregnancy: String,
  precautions: String,
  overdose: String,
  therapeuticClass: String,
  storage: String,
  questions: String,
  url: String,
});
module.exports = mongoose.model("Medicine", MedicineSchema);
