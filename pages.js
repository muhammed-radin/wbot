const express = require("express");
const router = express.Router();
const path = require("path");

router.get("/:fileID", function(req, res) {
  res.sendFile(path.join(__dirname, "/localStore/" + req.params.fileID));
});


module.exports = router;