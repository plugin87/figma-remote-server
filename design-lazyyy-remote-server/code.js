// Design Lazyyy — Figma Desktop Bridge Plugin
// Runs in Figma plugin sandbox. Receives commands from UI frame via WebSocket.

figma.showUI(__html__, { visible: true, width: 400, height: 300 });

// Console forwarding via figma.ui.postMessage (no console override)
function bridgeLog(level, msg) {
  figma.ui.postMessage({ type: "console_log", level: level, message: msg });
}

// Command handlers
var handlers = {
  execute: function (payload) {
    var fn = new Function("figma", payload.code);
    return Promise.race([
      fn(figma),
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error("Execution timed out after " + (payload.timeout || 5000) + "ms")); }, payload.timeout || 5000);
      }),
    ]);
  },

  create_variable: function (p) {
    var collection = figma.variables.getVariableCollectionById(p.collection_id);
    if (!collection) throw new Error("Collection " + p.collection_id + " not found");
    var variable = figma.variables.createVariable(p.name, collection, p.resolved_type);
    if (p.description) variable.description = p.description;
    if (p.scopes) variable.scopes = p.scopes;
    if (p.values) {
      Object.keys(p.values).forEach(function (modeId) {
        variable.setValueForMode(modeId, p.values[modeId]);
      });
    }
    return { id: variable.id, name: variable.name, key: variable.key };
  },

  update_variable: function (p) {
    var variable = figma.variables.getVariableById(p.variable_id);
    if (!variable) throw new Error("Variable " + p.variable_id + " not found");
    if (p.name) variable.name = p.name;
    if (p.description !== undefined) variable.description = p.description;
    if (p.values) {
      Object.keys(p.values).forEach(function (modeId) {
        variable.setValueForMode(modeId, p.values[modeId]);
      });
    }
    return { id: variable.id, name: variable.name };
  },

  delete_variable: function (p) {
    var variable = figma.variables.getVariableById(p.variable_id);
    if (!variable) throw new Error("Variable " + p.variable_id + " not found");
    variable.remove();
    return { deleted: p.variable_id };
  },

  rename_variable: function (p) {
    var variable = figma.variables.getVariableById(p.variable_id);
    if (!variable) throw new Error("Variable " + p.variable_id + " not found");
    variable.name = p.new_name;
    return { id: variable.id, name: variable.name };
  },

  create_variable_collection: function (p) {
    var collection = figma.variables.createVariableCollection(p.name);
    if (p.initial_mode_name) {
      collection.renameMode(collection.modes[0].modeId, p.initial_mode_name);
    }
    return { id: collection.id, name: collection.name, modes: collection.modes };
  },

  delete_variable_collection: function (p) {
    var collection = figma.variables.getVariableCollectionById(p.collection_id);
    if (!collection) throw new Error("Collection " + p.collection_id + " not found");
    collection.remove();
    return { deleted: p.collection_id };
  },

  add_mode: function (p) {
    var collection = figma.variables.getVariableCollectionById(p.collection_id);
    if (!collection) throw new Error("Collection " + p.collection_id + " not found");
    var modeId = collection.addMode(p.mode_name);
    return { modeId: modeId, name: p.mode_name, collectionId: p.collection_id };
  },

  rename_mode: function (p) {
    var collection = figma.variables.getVariableCollectionById(p.collection_id);
    if (!collection) throw new Error("Collection " + p.collection_id + " not found");
    collection.renameMode(p.mode_id, p.new_name);
    return { modeId: p.mode_id, name: p.new_name };
  },

  batch_create_variables: function (p) {
    var collection = figma.variables.getVariableCollectionById(p.collection_id);
    if (!collection) throw new Error("Collection " + p.collection_id + " not found");
    var results = [];
    p.variables.forEach(function (v) {
      var variable = figma.variables.createVariable(v.name, collection, v.resolved_type);
      if (v.description) variable.description = v.description;
      if (v.values) {
        Object.keys(v.values).forEach(function (modeId) {
          variable.setValueForMode(modeId, v.values[modeId]);
        });
      }
      results.push({ id: variable.id, name: variable.name, key: variable.key });
    });
    return { created: results.length, variables: results };
  },

  batch_update_variables: function (p) {
    var results = [];
    p.updates.forEach(function (u) {
      var variable = figma.variables.getVariableById(u.variable_id);
      if (!variable) {
        results.push({ id: u.variable_id, error: "Not found" });
        return;
      }
      if (u.name) variable.name = u.name;
      if (u.description !== undefined) variable.description = u.description;
      if (u.values) {
        Object.keys(u.values).forEach(function (modeId) {
          variable.setValueForMode(modeId, u.values[modeId]);
        });
      }
      results.push({ id: variable.id, name: variable.name });
    });
    return { updated: results.length, variables: results };
  },

  resize_node: function (p) {
    var node = figma.getNodeById(p.node_id);
    if (!node) throw new Error("Node " + p.node_id + " not found");
    if ("resize" in node) {
      var w = (p.width != null) ? p.width : node.width;
      var h = (p.height != null) ? p.height : node.height;
      node.resize(w, h);
      return { id: node.id, width: w, height: h };
    }
    throw new Error("Node " + p.node_id + " cannot be resized");
  },

  move_node: function (p) {
    var node = figma.getNodeById(p.node_id);
    if (!node) throw new Error("Node " + p.node_id + " not found");
    if ("x" in node) {
      node.x = p.x;
      node.y = p.y;
      return { id: node.id, x: p.x, y: p.y };
    }
    throw new Error("Node " + p.node_id + " cannot be moved");
  },

  set_fills: function (p) {
    var node = figma.getNodeById(p.node_id);
    if (!node) throw new Error("Node " + p.node_id + " not found");
    if ("fills" in node) {
      node.fills = p.fills.map(function (f) {
        return {
          type: f.type || "SOLID",
          color: { r: f.color.r, g: f.color.g, b: f.color.b },
          opacity: (f.opacity != null) ? f.opacity : ((f.color.a != null) ? f.color.a : 1),
        };
      });
      return { id: node.id, fillCount: p.fills.length };
    }
    throw new Error("Node " + p.node_id + " does not support fills");
  },

  set_strokes: function (p) {
    var node = figma.getNodeById(p.node_id);
    if (!node) throw new Error("Node " + p.node_id + " not found");
    if ("strokes" in node) {
      node.strokes = p.strokes.map(function (s) {
        return {
          type: s.type || "SOLID",
          color: { r: s.color.r, g: s.color.g, b: s.color.b },
        };
      });
      if (p.stroke_weight != null && "strokeWeight" in node) node.strokeWeight = p.stroke_weight;
      if (p.stroke_align && "strokeAlign" in node) node.strokeAlign = p.stroke_align;
      return { id: node.id };
    }
    throw new Error("Node " + p.node_id + " does not support strokes");
  },

  set_text: function (p) {
    var node = figma.getNodeById(p.node_id);
    if (!node || node.type !== "TEXT") throw new Error("Node " + p.node_id + " is not a text node");
    var family = p.font_family || node.fontName.family;
    var style = p.font_weight ? (p.font_weight >= 700 ? "Bold" : p.font_weight >= 500 ? "Medium" : "Regular") : node.fontName.style;
    var fontName = { family: family, style: style };
    return figma.loadFontAsync(fontName).then(function () {
      node.fontName = fontName;
      if (p.font_size) node.fontSize = p.font_size;
      node.characters = p.text;
      return { id: node.id, text: p.text };
    });
  },

  clone_node: function (p) {
    var node = figma.getNodeById(p.node_id);
    if (!node) throw new Error("Node " + p.node_id + " not found");
    if ("clone" in node) {
      var clone = node.clone();
      if ("x" in clone) {
        clone.x = node.x + ((p.offset_x != null) ? p.offset_x : 20);
        clone.y = node.y + ((p.offset_y != null) ? p.offset_y : 20);
      }
      return { id: clone.id, name: clone.name };
    }
    throw new Error("Node " + p.node_id + " cannot be cloned");
  },

  delete_node: function (p) {
    var node = figma.getNodeById(p.node_id);
    if (!node) throw new Error("Node " + p.node_id + " not found");
    if ("remove" in node) {
      var name = node.name;
      node.remove();
      return { deleted: p.node_id, name: name };
    }
    throw new Error("Node " + p.node_id + " cannot be deleted");
  },

  rename_node: function (p) {
    var node = figma.getNodeById(p.node_id);
    if (!node) throw new Error("Node " + p.node_id + " not found");
    node.name = p.new_name;
    return { id: node.id, name: p.new_name };
  },

  create_child: function (p) {
    var parent = figma.getNodeById(p.parent_id);
    if (!parent) throw new Error("Parent " + p.parent_id + " not found");
    if (!("appendChild" in parent)) throw new Error("Node " + p.parent_id + " cannot have children");

    var child;
    switch (p.type) {
      case "FRAME": child = figma.createFrame(); break;
      case "TEXT":
        child = figma.createText();
        return figma.loadFontAsync({ family: "Inter", style: "Regular" }).then(function () {
          if (p.name) child.name = p.name;
          if (p.width && p.height && "resize" in child) child.resize(p.width, p.height);
          if (p.x != null && "x" in child) child.x = p.x;
          if (p.y != null && "y" in child) child.y = p.y;
          parent.appendChild(child);
          return { id: child.id, name: child.name, type: child.type };
        });
      case "RECTANGLE": child = figma.createRectangle(); break;
      case "ELLIPSE": child = figma.createEllipse(); break;
      case "LINE": child = figma.createLine(); break;
      case "COMPONENT": child = figma.createComponent(); break;
      default: throw new Error("Unsupported type: " + p.type);
    }

    if (p.name) child.name = p.name;
    if (p.width && p.height && "resize" in child) child.resize(p.width, p.height);
    if (p.x != null && "x" in child) child.x = p.x;
    if (p.y != null && "y" in child) child.y = p.y;
    parent.appendChild(child);
    return { id: child.id, name: child.name, type: child.type };
  },

  create_slot: function (p) {
    var component = figma.getNodeById(p.component_id);
    if (!component || component.type !== "COMPONENT") {
      throw new Error("Node " + p.component_id + " is not a component");
    }
    // Snapshot existing property keys before createSlot
    var propsBefore = component.componentPropertyDefinitions
      ? Object.keys(component.componentPropertyDefinitions)
      : [];

    var slot = component.createSlot();
    slot.name = p.slot_name || "slot";
    if (p.width && p.height) slot.resize(p.width, p.height);
    else if (p.width) slot.resize(p.width, slot.height);
    else if (p.height) slot.resize(slot.width, p.height);

    // Delete the auto-generated duplicate property from createSlot()
    var propsAfter = component.componentPropertyDefinitions
      ? Object.keys(component.componentPropertyDefinitions)
      : [];
    var autoKeys = propsAfter.filter(function (k) { return propsBefore.indexOf(k) === -1; });
    autoKeys.forEach(function (k) {
      try { component.deleteComponentProperty(k); } catch (e) { /* ignore */ }
    });

    // Add our own named property and bind it
    var propKey = component.addComponentProperty(
      p.property_name || p.slot_name || "slot",
      "SLOT",
      p.default_value || ""
    );
    slot.componentPropertyReferences = { slotContentId: propKey };
    return {
      slotId: slot.id,
      slotName: slot.name,
      propertyKey: propKey,
      componentId: component.id,
    };
  },

  add_component_property: function (p) {
    var component = figma.getNodeById(p.component_id);
    if (!component || component.type !== "COMPONENT") {
      throw new Error("Node " + p.component_id + " is not a component");
    }
    var propKey = component.addComponentProperty(
      p.property_name,
      p.property_type,
      p.default_value || ""
    );
    return {
      propertyKey: propKey,
      propertyName: p.property_name,
      propertyType: p.property_type,
      componentId: component.id,
    };
  },

  instantiate_component: function (p) {
    var component = figma.getNodeById(p.component_id);
    if (!component || component.type !== "COMPONENT") {
      throw new Error("Component " + p.component_id + " not found");
    }
    var instance = component.createInstance();
    if (p.x != null) instance.x = p.x;
    if (p.y != null) instance.y = p.y;
    if (p.parent_id) {
      var parent = figma.getNodeById(p.parent_id);
      if (parent && "appendChild" in parent) parent.appendChild(instance);
    }
    return { id: instance.id, name: instance.name };
  },

  set_description: function (p) {
    var node = figma.getNodeById(p.node_id);
    if (!node) throw new Error("Node " + p.node_id + " not found");
    if ("description" in node) {
      node.description = p.description;
      return { id: node.id, description: p.description };
    }
    throw new Error("Node " + p.node_id + " does not support descriptions");
  },

  set_image_fill: function (p) {
    var node = figma.getNodeById(p.node_id);
    if (!node || !("fills" in node)) throw new Error("Node " + p.node_id + " cannot have fills");
    var imageHash = p.image_hash;
    if (p.image_url && !imageHash) {
      return fetch(p.image_url)
        .then(function (response) { return response.arrayBuffer(); })
        .then(function (buffer) {
          var image = figma.createImage(new Uint8Array(buffer));
          node.fills = [{ type: "IMAGE", scaleMode: p.scale_mode || "FILL", imageHash: image.hash }];
          return { id: node.id, imageHash: image.hash };
        });
    }
    if (!imageHash) throw new Error("Either image_url or image_hash is required");
    node.fills = [{ type: "IMAGE", scaleMode: p.scale_mode || "FILL", imageHash: imageHash }];
    return { id: node.id, imageHash: imageHash };
  },

  arrange_component_set: function (p) {
    var node = figma.getNodeById(p.component_set_id);
    if (!node || node.type !== "COMPONENT_SET") {
      throw new Error("Node " + p.component_set_id + " is not a component set");
    }
    var gap = (p.spacing != null) ? p.spacing : 40;
    var children = node.children.filter(function (c) { return c.type === "COMPONENT"; });
    var cols = (p.columns != null) ? p.columns : Math.ceil(Math.sqrt(children.length));
    for (var i = 0; i < children.length; i++) {
      children[i].x = (i % cols) * (children[i].width + gap);
      children[i].y = Math.floor(i / cols) * (children[i].height + gap);
    }
    return { arranged: children.length, columns: cols };
  },

  setup_design_tokens: function (p) {
    var primitiveCollection = figma.variables.createVariableCollection("Primitives");
    primitiveCollection.renameMode(primitiveCollection.modes[0].modeId, "Value");
    var semanticCollection = figma.variables.createVariableCollection("Semantic");
    var lightModeId = semanticCollection.modes[0].modeId;
    semanticCollection.renameMode(lightModeId, "Light");
    var darkModeId;
    if (p.includeDarkMode) {
      darkModeId = semanticCollection.addMode("Dark");
    }
    return {
      collections: {
        primitive: { id: primitiveCollection.id, name: primitiveCollection.name },
        semantic: { id: semanticCollection.id, name: semanticCollection.name },
      },
      modes: { light: lightModeId, dark: darkModeId },
      message: "Created " + p.preset + " token architecture" + (p.includeDarkMode ? " with dark mode" : ""),
    };
  },
};

// Handle messages from UI
figma.ui.on("message", function (msg) {
  if (msg.type === "command") {
    var handler = handlers[msg.commandType];
    if (!handler) {
      figma.ui.postMessage({ type: "command_response", id: msg.id, success: false, error: "Unknown command: " + msg.commandType });
      return;
    }
    Promise.resolve()
      .then(function () { return handler(msg.payload); })
      .then(function (result) {
        figma.ui.postMessage({ type: "command_response", id: msg.id, success: true, result: result });
      })
      .catch(function (err) {
        figma.ui.postMessage({ type: "command_response", id: msg.id, success: false, error: err.message || String(err) });
      });
  }
});
