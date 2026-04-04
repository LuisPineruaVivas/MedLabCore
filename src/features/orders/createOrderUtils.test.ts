import { describe, expect, it } from "vitest";
import {
  addSearchItemToCart,
  buildOrderReceiptData,
  buildSearchItems,
  buildSelectedPatientSummary,
  calculateCartTotal,
  calculateCartTotalBs,
  filterSearchItems,
  removeCartItem,
} from "./createOrderUtils";

const templates = [
  {
    id: "tpl-1",
    name: "Hemograma",
    category: "Hematologia",
    base_price: "12.5",
    schema: { sections: [] },
  },
];

const profiles = [
  {
    id: "profile-1",
    name: "Perfil Basico",
    description: "Rutina",
    total_price: "20",
    profile_templates_junction: [
      {
        test_templates: {
          id: "tpl-2",
          name: "Glucosa",
          category: "Quimica",
          base_price: "8",
          schema: { sections: [] },
        },
      },
      {
        test_templates: {
          id: "tpl-3",
          name: "Urea",
          category: "Quimica",
          base_price: "7",
          schema: { sections: [] },
        },
      },
    ],
  },
];

describe("createOrderUtils", () => {
  it("builds searchable items from exams and profiles", () => {
    const items = buildSearchItems(templates, profiles);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      type: "profile",
      id: "profile-1",
      templateCount: 2,
    });
    expect(items[1]).toMatchObject({
      type: "exam",
      id: "tpl-1",
      price: 12.5,
    });
  });

  it("filters search items by name or exam category", () => {
    const items = buildSearchItems(templates, profiles);

    expect(filterSearchItems(items, "hema")).toHaveLength(1);
    expect(filterSearchItems(items, "quimica")).toHaveLength(0);
    expect(filterSearchItems(items, "perfil")).toHaveLength(1);
  });

  it("adds standalone exams once and expands profiles into header plus children", () => {
    const items = buildSearchItems(templates, profiles);
    const exam = items[1];
    const profile = items[0];

    const examCart = addSearchItemToCart([], exam);
    expect(examCart).toHaveLength(1);
    expect(addSearchItemToCart(examCart, exam)).toEqual(examCart);

    const profileCart = addSearchItemToCart(examCart, profile);
    expect(profileCart).toHaveLength(4);
    expect(profileCart[1]).toMatchObject({
      isProfileHeader: true,
      profileId: "profile-1",
      price: 20,
    });
    expect(profileCart[2]).toMatchObject({
      parentProfileId: "profile-1",
      price: 0,
    });
  });

  it("removes standalone items and removes full profile groups from cart", () => {
    const items = buildSearchItems(templates, profiles);
    const cartWithProfile = addSearchItemToCart([], items[0]);
    const profileHeader = cartWithProfile[0];
    const profileChild = cartWithProfile[1];

    expect(removeCartItem(cartWithProfile, profileChild)).toEqual(cartWithProfile);
    expect(removeCartItem(cartWithProfile, profileHeader)).toHaveLength(0);
  });

  it("calculates totals and receipt data using billable items only", () => {
    const cart = addSearchItemToCart(addSearchItemToCart([], buildSearchItems(templates, profiles)[1]), buildSearchItems(templates, profiles)[0]);
    const total = calculateCartTotal(cart);

    expect(total).toBe(32.5);
    expect(calculateCartTotalBs(total, 40)).toBe(1300);

    const receipt = buildOrderReceiptData({
      orderId: "ord-1",
      selectedPatient: {
        first_name: "Ana",
        last_name: "Perez",
        id_number: "V123",
        date_of_birth: "2000-03-30",
        gender: "F",
      },
      cart,
      total,
      exchangeRate: 40,
      totalBs: 1300,
      accessPin: "9999",
      now: new Date("2026-03-30T10:00:00Z"),
    });

    expect(receipt.items).toEqual([
      { test_name: "Hemograma", price: 12.5 },
      { test_name: "Perfil Basico", price: 20 },
    ]);
    expect(receipt.patientName).toBe("ANA PEREZ");
    expect(receipt.totalBs).toBe(1300);
  });

  it("builds patient summary text with optional age and gender", () => {
    const summary = buildSelectedPatientSummary({
      first_name: "Ana",
      last_name: "Perez",
      id_number: "V123",
      date_of_birth: "2000-03-30",
      gender: "F",
    });

    expect(summary).toContain("ID: V123");
    expect(summary).toContain("anos");
    expect(summary).toContain("F");
  });
});
