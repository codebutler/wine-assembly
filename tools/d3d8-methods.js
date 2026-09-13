// IDirect3D8 factory-interface ABI.  This is intentionally only the 16-slot
// factory vtable: CreateDevice reports D3DERR_NOTAVAILABLE, so exposing it does
// not imply an IDirect3DDevice8 implementation.

'use strict';

const interfaces = [
  { prefix: 'IDirect3D8', methods: [
    { name: 'QueryInterface',             nargs: 3 },
    { name: 'AddRef',                     nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',                    nargs: 1, handler: 'dx_com_release_basic' },
    { name: 'RegisterSoftwareDevice',     nargs: 2 },
    { name: 'GetAdapterCount',            nargs: 1 },
    { name: 'GetAdapterIdentifier',       nargs: 4 },
    { name: 'GetAdapterModeCount',        nargs: 2 },
    { name: 'EnumAdapterModes',           nargs: 4 },
    { name: 'GetAdapterDisplayMode',      nargs: 3 },
    { name: 'CheckDeviceType',            nargs: 6, handler: 'd3d8_not_available_6' },
    { name: 'CheckDeviceFormat',          nargs: 7, handler: 'd3d8_not_available_7' },
    { name: 'CheckDeviceMultiSampleType', nargs: 6, handler: 'd3d8_not_available_6' },
    { name: 'CheckDepthStencilMatch',     nargs: 6, handler: 'd3d8_not_available_6' },
    { name: 'GetDeviceCaps',              nargs: 4 },
    { name: 'GetAdapterMonitor',          nargs: 2 },
    { name: 'CreateDevice',               nargs: 7, handler: 'd3d8_not_available_7' },
  ] },
];

const vtableGlobals = [
  { prefix: 'IDirect3D8', global: 'DX_VTBL_D3D8', methods: interfaces[0].methods.map(m => m.name) },
];

module.exports = { interfaces, vtableGlobals };
