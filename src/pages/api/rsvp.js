export const prerender = false;

import { getStore } from '@netlify/blobs';

// Use Netlify Blobs for production storage
const STORAGE_KEY = 'wedding-rsvp-guests';
const STORE_NAME = 'wedding-data';

async function readGuestData(context) {
  try {
    // Try to get Netlify Blobs store
    const store = getStore({
      name: STORE_NAME,
      siteID: context?.site?.id,
      token: context?.token
    });

    const data = await store.get(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }

    return [];
  } catch (error) {
    console.error('Error reading guest data:', error);

    // Fallback for local development - use localStorage simulation
    if (typeof globalThis !== 'undefined' && !globalThis.localStorage) {
      globalThis.localStorage = new Map();
    }

    const stored = globalThis.localStorage?.get?.(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }
}

async function writeGuestData(context, data) {
  try {
    // Try to get Netlify Blobs store
    const store = getStore({
      name: STORE_NAME,
      siteID: context?.site?.id,
      token: context?.token
    });

    await store.set(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error writing guest data:', error);

    // Fallback for local development
    if (typeof globalThis !== 'undefined') {
      if (!globalThis.localStorage) {
        globalThis.localStorage = new Map();
      }
      globalThis.localStorage.set(STORAGE_KEY, JSON.stringify(data));
      return true;
    }

    return false;
  }
}

function isGuestAlreadyConfirmed(guests, firstName, lastName) {
  return guests.some(guest => 
    guest.NOMBRE === firstName.toUpperCase() && 
    guest.APELLIDOS === lastName.toUpperCase()
  );
}

export async function POST({ request, locals, site, cookies }) {
  const context = { site, token: import.meta.env.NETLIFY_BLOBS_CONTEXT };
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

    const existingGuests = await readGuestData(context);

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

    const success = await writeGuestData(context, updatedGuests);

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

export async function GET({ locals, site }) {
  const context = { site, token: import.meta.env.NETLIFY_BLOBS_CONTEXT };
  try {
    const guests = await readGuestData(context);
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