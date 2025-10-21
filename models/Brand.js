const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema({
  name: String,
  strength: String,
  generic: String,
  company: String,
  dosageIcon: String,
  link: String,
  isDetails: { type: Boolean, default: false },
});

module.exports = mongoose.model("Brand", brandSchema);