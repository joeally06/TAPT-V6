import React, { useMemo } from 'react';

export interface MealOption {
  id: string;
  label: string;
  enabled: boolean;
}

interface MealTicketSelectionProps {
  mealsAvailable: MealOption[];
  mealPrice: number;
  selectedMeals: string[];
  allMealsSelected: boolean;
  onMealToggle: (mealId: string) => void;
  onAllMealsToggle: (selectAll: boolean) => void;
}

/**
 * Reusable meal ticket selection component for tech conference registration.
 * Displays available meals, individual checkboxes, an "attend all" toggle,
 * and a running total.
 */
export const MealTicketSelection: React.FC<MealTicketSelectionProps> = ({
  mealsAvailable,
  mealPrice,
  selectedMeals,
  allMealsSelected,
  onMealToggle,
  onAllMealsToggle,
}) => {
  const enabledMeals = useMemo(
    () => mealsAvailable.filter((m) => m.enabled),
    [mealsAvailable]
  );

  const mealTotal = useMemo(
    () => selectedMeals.length * mealPrice,
    [selectedMeals, mealPrice]
  );

  if (enabledMeals.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-2">
        <h3 className="text-lg font-semibold text-gray-900">
          🍽️ Meal Ticket Selection
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          ${mealPrice.toFixed(2)} per meal per person
        </p>
      </div>

      {/* Select All Meals toggle */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allMealsSelected}
            onChange={(e) => onAllMealsToggle(e.target.checked)}
            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <div>
            <span className="font-semibold text-blue-900">
              I plan to attend all meals
            </span>
            <span className="block text-sm text-blue-700">
              {enabledMeals.length} meals × ${mealPrice.toFixed(2)} = $
              {(enabledMeals.length * mealPrice).toFixed(2)}
            </span>
          </div>
        </label>
      </div>

      {/* Individual Meal Checkboxes */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">
          Or select individual meals:
        </p>
        {enabledMeals.map((meal) => {
          const isSelected = selectedMeals.includes(meal.id);
          return (
            <label
              key={meal.id}
              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-green-50 border-green-300'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              } ${allMealsSelected ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onMealToggle(meal.id)}
                  disabled={allMealsSelected}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span
                  className={`font-medium ${
                    isSelected ? 'text-green-900' : 'text-gray-700'
                  }`}
                >
                  {meal.label}
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-600">
                ${mealPrice.toFixed(2)}
              </span>
            </label>
          );
        })}
      </div>

      {/* Meal Total */}
      <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-between">
        <div>
          <span className="font-semibold text-gray-900">Meal Total</span>
          <span className="block text-sm text-gray-600">
            {selectedMeals.length} meal{selectedMeals.length !== 1 ? 's' : ''}{' '}
            selected
          </span>
        </div>
        <span className="text-xl font-bold text-green-700">
          ${mealTotal.toFixed(2)}
        </span>
      </div>
    </div>
  );
};

export default MealTicketSelection;
