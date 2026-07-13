/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * CANINANA COLETOR - GOOGLE APPS SCRIPT BACKEND
 * Integração sob medida com a Planilha Oficial da Caninana Auto Vidros.
 * 
 * INSTRUÇÕES DE IMPLANTAÇÃO:
 * 1. Abra sua Planilha Google: https://docs.google.com/spreadsheets/d/1hpSmTKNZPfvopm_ZayB3KXibNF2CFLwnpqG-OC8WFvg/edit
 * 2. Vá em Extensões > Apps Script.
 * 3. Apague todo o código existente e cole este código completo.
 * 4. Clique em "Salvar" (ícone de disquete).
 * 5. Clique em "Implantar" > "Nova implantação".
 * 6. Tipo de implantação: selecione "App da Web" (ícone de engrenagem).
 * 7. Configurações:
 *    - Executar como: "Eu" (seu e-mail).
 *    - Quem tem acesso: "Qualquer pessoa" (necessário para que o celular envie os dados diretamente).
 * 8. Clique em "Implantar", autorize as permissões da sua conta e COPIE a "URL do app da Web" gerada.
 * 9. Cole essa URL no painel de sincronização do Caninana Coletor no seu smartphone!
 */

function doPost(e) {
  try {
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    var result;

    if (action === "fetch") {
      result = fetchAllData();
    } else if (action === "sync") {
      result = syncData(requestData.payload);
    } else {
      throw new Error("Ação inválida: " + action);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  try {
    var result = fetchAllData();
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Retorna todos os dados da planilha organizados em objetos JSON
function fetchAllData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  return {
    products: getProductsFromSheet(ss.getSheetByName("CADASTRO PRODUTOS")),
    movements: getMovementsFromSheet(ss),
    inventory: getInventoryFromSheet(ss.getSheetByName("INVENTÁRIO GERAL")),
    users: getSheetAsJson(ss.getSheetByName("Usuários")) || [],
    logs: getSheetAsJson(ss.getSheetByName("Logs")) || []
  };
}

// Lê os produtos da aba CADASTRO PRODUTOS (ignorando as 4 linhas de cabeçalho informativo)
function getProductsFromSheet(sheet) {
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 5) return []; // Linha 4 é o cabeçalho real
  
  var data = sheet.getRange(5, 1, lastRow - 4, 17).getValues();
  var products = [];
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var barcode = String(row[0] || '').trim();
    if (!barcode) continue;
    
    products.push({
      barcode: barcode,
      description: String(row[1] || ''),
      category: String(row[2] || ''),
      application: String(row[3] || ''),
      location: String(row[4] || ''),
      stock: Number(row[12] || 0), // Saldo Teorico (coluna M)
      minStock: Number(row[6] || 3)  // Estoque Mínimo (coluna G)
    });
  }
  return products;
}

// Lê o histórico de movimentações (Entradas + Saídas)
function getMovementsFromSheet(ss) {
  var movements = [];
  
  // Entradas
  var sheetEntradas = ss.getSheetByName("ENTRADAS NF");
  if (sheetEntradas && sheetEntradas.getLastRow() >= 5) {
    var dataEntradas = sheetEntradas.getRange(5, 1, sheetEntradas.getLastRow() - 4, 11).getValues();
    for (var i = 0; i < dataEntradas.length; i++) {
      var row = dataEntradas[i];
      var barcode = String(row[2] || '').trim();
      if (!barcode) continue;
      
      movements.push({
        id: "ent_" + i + "_" + barcode,
        barcode: barcode,
        type: "Entrada",
        quantity: Number(row[5] || 0),
        date: formatDate(row[0]),
        user: String(row[9] || 'Sistema'),
        synced: true
      });
    }
  }
  
  // Saídas
  var sheetSaidas = ss.getSheetByName("SAÍDAS DIÁRIAS");
  if (sheetSaidas && sheetSaidas.getLastRow() >= 5) {
    var dataSaidas = sheetSaidas.getRange(5, 1, sheetSaidas.getLastRow() - 4, 10).getValues();
    for (var j = 0; j < dataSaidas.length; j++) {
      var row = dataSaidas[j];
      var barcode = String(row[1] || '').trim();
      if (!barcode) continue;
      
      movements.push({
        id: "sai_" + j + "_" + barcode,
        barcode: barcode,
        type: "Saída",
        quantity: Number(row[3] || 0),
        date: formatDate(row[0]),
        user: String(row[8] || 'Sistema'),
        synced: true
      });
    }
  }
  
  return movements;
}

// Lê a contagem de inventário físico
function getInventoryFromSheet(sheet) {
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 5) return [];
  
  var data = sheet.getRange(5, 1, lastRow - 4, 10).getValues();
  var inventory = [];
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var barcode = String(row[1] || '').trim();
    var countedQty = row[5];
    if (!barcode || countedQty === "") continue;
    
    inventory.push({
      barcode: barcode,
      countedQuantity: Number(countedQty),
      date: formatDate(row[0]),
      user: String(row[8] || 'Sistema'),
      synced: true
    });
  }
  return inventory;
}

// Converte os dados de uma aba específica padrão para JSON
function getSheetAsJson(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  var headers = data[0];
  var jsonArray = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    var emptyRow = true;
    for (var j = 0; j < headers.length; j++) {
      var cellVal = row[j];
      obj[headers[j]] = cellVal;
      if (cellVal !== "") emptyRow = false;
    }
    if (!emptyRow) {
      jsonArray.push(obj);
    }
  }
  return jsonArray;
}

// Sincroniza coletas recebidas do aplicativo nas abas corretas da planilha
function syncData(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  // 1. Inserir Movimentações
  if (payload.movements && payload.movements.length > 0) {
    var sheetEntradas = ss.getSheetByName("ENTRADAS NF");
    var sheetSaidas = ss.getSheetByName("SAÍDAS DIÁRIAS");
    
    var results = [];
    for (var i = 0; i < payload.movements.length; i++) {
      var mov = payload.movements[i];
      var barcodeStr = String(mov.barcode);
      var description = getProductDescription(ss, barcodeStr);
      
      if (mov.type === "Entrada" && sheetEntradas) {
        var nextRow = sheetEntradas.getLastRow() + 1;
        sheetEntradas.appendRow([
          mov.date ? mov.date.split("T")[0] : dateStr, // Data Entrada
          "", // NF
          barcodeStr, // Código Produto
          description, // Descrição
          "", // Fornecedor
          Number(mov.quantity), // Quantidade Entrada
          0, // Valor Unitario
          "", // Frete Rateado
          "", // Valor Total
          mov.user, // Responsável
          "" // Observações
        ]);
        results.push({ barcode: barcodeStr, type: "Entrada", row: nextRow });
      } else if (mov.type === "Saída" && sheetSaidas) {
        var nextRow = sheetSaidas.getLastRow() + 1;
        sheetSaidas.appendRow([
          mov.date ? mov.date.split("T")[0] : dateStr, // Data
          barcodeStr, // Código Produto
          description, // Descrição
          Number(mov.quantity), // Qtd. Saída
          "", // Qtd. Estoque
          "", // OS / Pedido
          "", // Solicitante
          "Oficina", // Destino padrão
          mov.user, // Responsável
          "" // Observações
        ]);
        results.push({ barcode: barcodeStr, type: "Saída", row: nextRow });
      }
    }
    return { success: true, details: results };
  }
  return { success: true };
  
  // 2. Inserir Contagens de Inventário
  if (payload.inventory && payload.inventory.length > 0) {
    var sheetInv = ss.getSheetByName("INVENTÁRIO GERAL");
    if (sheetInv) {
      var dataInv = sheetInv.getDataRange().getValues();
      
      for (var j = 0; j < payload.inventory.length; j++) {
        var inv = payload.inventory[j];
        var barcodeStr = String(inv.barcode);
        var found = false;
        
        // Procurar o produto no Inventário Geral para atualizar a quantidade física na linha existente
        for (var rowIdx = 4; rowIdx < dataInv.length; rowIdx++) {
          if (String(dataInv[rowIdx][1] || '').trim() === barcodeStr) {
            sheetInv.getRange(rowIdx + 1, 6).setValue(Number(inv.countedQuantity)); // Qtd. Física (Coluna F)
            sheetInv.getRange(rowIdx + 1, 1).setValue(inv.date ? inv.date.split("T")[0] : dateStr); // Data Contagem (Coluna A)
            sheetInv.getRange(rowIdx + 1, 9).setValue(inv.user); // Responsável (Coluna I)
            found = true;
            break;
          }
        }
        
        // Se for um produto novo que não estava no inventário, adiciona uma nova linha
        if (!found) {
          var description = getProductDescription(ss, barcodeStr);
          sheetInv.appendRow([
            inv.date ? inv.date.split("T")[0] : dateStr, // Data Contagem
            barcodeStr, // Código Produto
            description, // Descrição
            "Geral", // Localização
            0, // Qtd. Sistema
            Number(inv.countedQuantity), // Qtd. Física
            "", // Divergência (fórmula)
            "", // Situação
            inv.user, // Responsável
            "Item novo inventariado via Smartphone" // Observações
          ]);
        }
      }
    }
  }

  // 3. Registrar Logs na planilha
  if (payload.logs && payload.logs.length > 0) {
    var sheetLogs = ss.getSheetByName("Logs");
    if (!sheetLogs) {
      sheetLogs = ss.insertSheet("Logs");
      sheetLogs.appendRow(["id", "timestamp", "message", "type", "user"]);
    }
    var existingLogIds = getColumnValues(sheetLogs, 1);
    for (var k = 0; k < payload.logs.length; k++) {
      var log = payload.logs[k];
      if (existingLogIds.indexOf(log.id) === -1) {
        sheetLogs.appendRow([
          log.id,
          log.timestamp,
          log.message,
          log.type,
          log.user
        ]);
      }
    }
  }

  // 4. Se houver novos produtos cadastrados no Coletor
  if (payload.newProducts && payload.newProducts.length > 0) {
    var sheetProd = ss.getSheetByName("CADASTRO PRODUTOS");
    if (sheetProd) {
      var existingBarcodes = getColumnValues(sheetProd, 1);
      for (var p = 0; p < payload.newProducts.length; p++) {
        var prod = payload.newProducts[p];
        var barcodeStr = String(prod.barcode);
        if (existingBarcodes.indexOf(barcodeStr) === -1) {
          sheetProd.appendRow([
            barcodeStr, // Código Produto (Coluna A)
            prod.description, // Descrição
            prod.category, // Categoria
            prod.application, // Aplicação
            prod.location || "Geral", // Localização
            "UN", // Unidade
            Number(prod.minStock), // Estoque Mínimo
            0, // Estoque Inicial
            "Sim", // Ativo?
            "", // Total Entradas (fórmula)
            "", // Total Saídas (fórmula)
            "", // Total Avarias (fórmula)
            "", // Saldo Teorico (fórmula)
            "", // Divergência Ult. Invent. (fórmula)
            "", // Status Estoque (fórmula)
            "", // Classe ABC (fórmula)
            ""  // Última Contagem
          ]);
        }
      }
    }
  }

  return fetchAllData();
}

// Helper para buscar a descrição de um produto na aba CADASTRO PRODUTOS
function getProductDescription(ss, barcode) {
  var sheet = ss.getSheetByName("CADASTRO PRODUTOS");
  if (!sheet) return "";
  var data = sheet.getDataRange().getValues();
  var barcodeStr = String(barcode).trim();
  for (var i = 4; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === barcodeStr) {
      return String(data[i][1] || '');
    }
  }
  return "";
}

function getColumnValues(sheet, colNum) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  var values = sheet.getRange(1, colNum, lastRow, 1).getValues();
  return values.map(function(row) { return String(row[0]); });
}

function formatDate(dateObj) {
  if (!dateObj) return "";
  if (dateObj instanceof Date) {
    return dateObj.toISOString();
  }
  return String(dateObj);
}
`;
