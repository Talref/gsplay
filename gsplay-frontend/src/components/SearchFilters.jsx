import React, { useState } from 'react';
import {
  Typography,
  FormControl,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Button,
  Box,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { Clear as ClearIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

const SearchFilters = ({ filters, filterOptions, onFilterChange }) => {
  const handleFilterToggle = (category, value) => {
    const currentValues = filters[category] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];

    onFilterChange({
      ...filters,
      [category]: newValues
    });
  };

  const clearAllFilters = () => {
    onFilterChange({
      genres: [],
      platforms: [],
      gameModes: []
    });
  };

  const hasActiveFilters = Object.values(filters).some(arr => arr.length > 0);

  const FilterSection = ({ title, category, options }) => (
    <Accordion
      defaultExpanded={false}
      sx={{
        boxShadow: 'none',
        border: 'none',
        '&:before': { display: 'none' },
        mb: 1
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: 'primary.main' }} />}
        sx={{
          minHeight: 48,
          px: 0,
          '& .MuiAccordionSummary-content': { margin: 0 }
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0, pt: 0 }}>
        <FormControl component="fieldset" fullWidth>
          <FormGroup>
            {options.map(option => (
              <FormControlLabel
                key={option}
                control={
                  <Checkbox
                    checked={(filters[category] || []).includes(option)}
                    onChange={() => handleFilterToggle(category, option)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    {option}
                  </Typography>
                }
              />
            ))}
          </FormGroup>
        </FormControl>
      </AccordionDetails>
    </Accordion>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Filters
        </Typography>
        {hasActiveFilters && (
          <Button
            size="small"
            onClick={clearAllFilters}
            startIcon={<ClearIcon />}
            variant="contained"
            sx={{
              textTransform: 'none',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                bgcolor: 'primary.dark'
              }
            }}
          >
            Clear All
          </Button>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      <FilterSection
        title="Genres"
        category="genres"
        options={filterOptions.genres || []}
      />

      <FilterSection
        title="Platforms"
        category="platforms"
        options={filterOptions.platforms || []}
      />

      <FilterSection
        title="Game Modes"
        category="gameModes"
        options={filterOptions.gameModes || []}
      />

      {hasActiveFilters && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'action.selected', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Active filters: {Object.values(filters).reduce((sum, arr) => sum + arr.length, 0)}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default SearchFilters;
