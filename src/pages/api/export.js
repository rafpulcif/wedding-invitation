import * as XLSX from 'xlsx';

export const prerender = false;

// Use the same storage functions as the main RSVP API
const STORAGE_KEY = 'wedding-rsvp-guests';

async function readGuestData(locals) {
  try {
    // Check if we're in a Netlify environment
    if (locals?.netlify?.blobs) {
      const store = locals.netlify.blobs;
      const data = await store.get(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    }

    // Fallback for local development
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      const stored = globalThis.localStorage.get(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    }

    return [];
  } catch (error) {
    console.error('Error reading guest data:', error);
    return [];
  }
}

export async function GET({ locals }) {
  try {
    const guests = await readGuestData(locals);

    if (guests.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No hay confirmaciones para exportar'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Excel workbook
    const worksheet = XLSX.utils.json_to_sheet(guests);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Confirmaciones');

    // Set column widths
    const cols = [
      { wch: 20 }, // NOMBRE
      { wch: 25 }, // APELLIDOS
      { wch: 15 }, // ACOMPAÑANTE
      { wch: 20 }, // NOMBRE_ACOMPAÑANTE
      { wch: 25 }, // APELLIDOS_ACOMPAÑANTE
      { wch: 20 }  // FECHA_CONFIRMACION
    ];
    worksheet['!cols'] = cols;

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="confirmaciones_boda.xlsx"'
      }
    });

  } catch (error) {
    console.error('Export Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al exportar las confirmaciones'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}