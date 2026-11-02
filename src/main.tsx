import React from "react"
import ReactDOM from "react-dom/client"
import IndexPopup from "./popup"
import "./style.css"

const rootElement = document.getElementById("root")
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <IndexPopup />
    </React.StrictMode>
  )
}

