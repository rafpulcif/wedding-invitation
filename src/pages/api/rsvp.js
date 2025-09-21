import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

export const prerender = false;

const EXCEL_FILE_PATH = path.join(process.cwd(), 'data', 'confirmaciones_boda.xlsx');

function ensureExcelFile() {
  const dataDir = path.dirname(EXCEL_FILE_PATH);
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    const initialData = [];
    const worksheet = XLSX.utils.json_to_sheet(initialData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Confirmaciones');
    
    const cols = [
      { wch: 20 }, // NOMBRE
      { wch: 25 }, // APELLIDOS
      { wch: 15 }, // ACOMPAÑANTE
      { wch: 20 }, // NOMBRE_ACOMPAÑANTE
      { wch: 25 }, // APELLIDOS_ACOMPAÑANTE
      { wch: 20 }  // FECHA_CONFIRMACION
    ];
    worksheet['!cols'] = cols;
    
    XLSX.writeFile(workbook, EXCEL_FILE_PATH);
  }
}

function readExcelFile() {
  try {
    ensureExcelFile();
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      return [];
    }
    const fileBuffer = fs.readFileSync(EXCEL_FILE_PATH);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets['Confirmaciones'];
    if (!worksheet) {
      return [];
    }
    return XLSX.utils.sheet_to_json(worksheet);
  } catch (error) {
    console.error('Error reading Excel file:', error);
    return [];
  }
}

function writeExcelFile(data) {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Confirmaciones');
    
    const cols = [
      { wch: 20 }, // NOMBRE
      { wch: 25 }, // APELLIDOS
      { wch: 15 }, // ACOMPAÑANTE
      { wch: 20 }, // NOMBRE_ACOMPAÑANTE
      { wch: 25 }, // APELLIDOS_ACOMPAÑANTE
      { wch: 20 }  // FECHA_CONFIRMACION
    ];
    worksheet['!cols'] = cols;
    
    XLSX.writeFile(workbook, EXCEL_FILE_PATH);
    return true;
  } catch (error) {
    console.error('Error writing Excel file:', error);
    return false;
  }
}

function isGuestAlreadyConfirmed(guests, firstName, lastName) {
  return guests.some(guest => 
    guest.NOMBRE === firstName.toUpperCase() && 
    guest.APELLIDOS === lastName.toUpperCase()
  );
}

export async function POST({ request }) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Datos de solicitud inválidos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { firstName, lastName, hasCompanion, companionFirstName, companionLastName } = body;
    
    if (!firstName || !lastName) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Nombre y apellidos son requeridos' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const existingGuests = readExcelFile();
    
    if (isGuestAlreadyConfirmed(existingGuests, firstName.trim(), lastName.trim())) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Este invitado ya ha confirmado su asistencia' 
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (hasCompanion && (!companionFirstName || !companionLastName)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Datos del acompañante son requeridos' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const guestData = {
      NOMBRE: firstName.trim().toUpperCase(),
      APELLIDOS: lastName.trim().toUpperCase(),
      ACOMPAÑANTE: hasCompanion ? 'SÍ' : 'NO',
      NOMBRE_ACOMPAÑANTE: hasCompanion ? companionFirstName.trim().toUpperCase() : '',
      APELLIDOS_ACOMPAÑANTE: hasCompanion ? companionLastName.trim().toUpperCase() : '',
      FECHA_CONFIRMACION: new Date().toLocaleString('es-ES')
    };
    
    const updatedGuests = [...existingGuests, guestData];
    
    const success = writeExcelFile(updatedGuests);
    
    if (success) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Confirmación registrada exitosamente',
        totalGuests: updatedGuests.length
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Error al guardar la confirmación' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error interno del servidor' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET() {
  try {
    const guests = readExcelFile();
    return new Response(JSON.stringify({ 
      success: true, 
      guests: guests,
      totalGuests: guests.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error al obtener las confirmaciones' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}