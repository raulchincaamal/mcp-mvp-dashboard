/* eslint-disable @typescript-eslint/no-unused-vars */
import { Session } from "next-auth"
import { JWT } from "next-auth/jwt"
import type Redis from "ioredis"

interface IUserProfile {
  name: string
  burks: string
  correo_electronico: string
  cve_usuario: string
  cve_empleado: string
  estatus: string
  grupo: string
  id_usuario: string
  nombre_usuario: string
  numero_telefono: string
  rol: string
  centros: string[]
}

declare module "next-auth/jwt" {
  interface JWT extends IUserProfile {
    jwtToken: string | undefined
  }
}

declare module "next-auth/adapters" {
  interface AdapterSession {
    id: string
  }
}

declare module "next-auth" {
  type Profile = IUserProfile

  interface User {
    profile: IUserProfile
    email: string
    name: string
  }

  interface Account {
    profile: IUserProfile
  }
  interface azureGroup {
    "@odata.type": string
    id: string
    description: string | null
    displayName: string | null
  }

  interface Session {
    user: {
      name: string
      email: string
      image: string
      cveUsuario: string
      employeeId: string
      grupoVendedor: string
      appGroups: azureGroup[]
      burks: string
      correo_electronico: string
      cve_usuario: string
      cve_empleado: string
      estatus: string
      grupo: string
      id_usuario: string
      nombre_usuario: string
      numero_telefono: string
      rol: string
      centros: string[]
    }
  }
}
